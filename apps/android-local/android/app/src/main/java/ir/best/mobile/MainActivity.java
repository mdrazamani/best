package ir.best.mobile;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new BestDownloadBridge(), "BestAndroid");
        }
    }

    public class BestDownloadBridge {
        @JavascriptInterface
        public String saveTextFile(String filename, String content, String mimeType) {
            String safeName = sanitizeFilename(filename);
            String safeMime = mimeType == null || mimeType.isEmpty() ? "text/plain;charset=utf-8" : mimeType;
            byte[] bytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
            return saveBytesFile(safeName, bytes, safeMime, false);
        }

        @JavascriptInterface
        public String savePdfFile(String filename, String title, String linesJson) {
            try {
                JSONArray lines = new JSONArray(linesJson == null ? "[]" : linesJson);
                byte[] bytes = createSimplePdf(title == null ? "BEST" : title, lines);
                String safeName = sanitizeFilename(filename == null || filename.trim().isEmpty() ? "best.pdf" : filename);
                if (!safeName.toLowerCase().endsWith(".pdf")) safeName = safeName + ".pdf";
                return saveBytesFile(safeName, bytes, "application/pdf", true);
            } catch (Exception error) {
                throw new RuntimeException("Could not save PDF: " + error.getMessage(), error);
            }
        }

        @JavascriptInterface
        public String saveLabelPdfFile(String filename, String labelsJson, boolean openAfterSave) {
            try {
                JSONArray labels = new JSONArray(labelsJson == null ? "[]" : labelsJson);
                byte[] bytes = createLabelPdf(labels);
                String safeName = sanitizeFilename(filename == null || filename.trim().isEmpty() ? "best-labels.pdf" : filename);
                if (!safeName.toLowerCase().endsWith(".pdf")) safeName = safeName + ".pdf";
                return saveBytesFile(safeName, bytes, "application/pdf", openAfterSave);
            } catch (Exception error) {
                throw new RuntimeException("Could not save labels PDF: " + error.getMessage(), error);
            }
        }

        @JavascriptInterface
        public String saveHtmlPdfFile(String filename, String html, int widthMm, int heightMm, boolean openAfterSave) {
            String safeName = sanitizeFilename(filename == null || filename.trim().isEmpty() ? "best.pdf" : filename);
            if (!safeName.toLowerCase().endsWith(".pdf")) safeName = safeName + ".pdf";
            String htmlContent = html == null ? "" : html;
            String finalSafeName = safeName;
            runOnUiThread(() -> renderHtmlPdfToDownloads(finalSafeName, htmlContent, widthMm, heightMm, openAfterSave));
            return "queued:" + safeName;
        }
    }

    private void renderHtmlPdfToDownloads(String safeName, String html, int widthMm, int heightMm, boolean openAfterSave) {
        WebView webView = new WebView(MainActivity.this);
        int pageWidthMm = widthMm > 0 ? widthMm : 210;
        int pageHeightMm = heightMm > 0 ? heightMm : 297;
        int viewWidthPx = mmToPx(pageWidthMm);
        int viewPageHeightPx = mmToPx(pageHeightMm);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(viewWidthPx, viewPageHeightPx);
        webView.setTranslationX(-viewWidthPx - 32);
        webView.setTranslationY(-viewPageHeightPx - 32);
        addContentView(webView, params);
        webView.setBackgroundColor(Color.WHITE);
        webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        webView.getSettings().setJavaScriptEnabled(false);
        webView.getSettings().setLoadsImagesAutomatically(true);
        webView.getSettings().setUseWideViewPort(false);
        webView.getSettings().setLoadWithOverviewMode(false);
        webView.setInitialScale(100);
        webView.setWebViewClient(new WebViewClient() {
            private boolean printed = false;

            @Override
            public void onPageFinished(WebView view, String url) {
                if (printed) return;
                printed = true;
                waitForWebViewAndRender(webView, safeName, widthMm, heightMm, openAfterSave, 0, -1);
            }
        });
        webView.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
    }

    private void waitForWebViewAndRender(
        WebView webView,
        String safeName,
        int widthMm,
        int heightMm,
        boolean openAfterSave,
        int attempt,
        int lastHeightPx
    ) {
        int currentHeightPx = Math.round(webView.getContentHeight() * webView.getScale());
        boolean hasContent = currentHeightPx > 0;
        boolean stable = hasContent && lastHeightPx > 0 && Math.abs(currentHeightPx - lastHeightPx) <= 2;
        boolean timedOut = attempt >= 24;

        if (!timedOut && (!hasContent || !stable || attempt < 3)) {
            webView.postDelayed(
                () -> waitForWebViewAndRender(webView, safeName, widthMm, heightMm, openAfterSave, attempt + 1, currentHeightPx),
                150
            );
            return;
        }

        try {
            byte[] bytes = renderWebViewToPdfBytes(webView, widthMm, heightMm);
            saveBytesFile(safeName, bytes, "application/pdf", openAfterSave);
        } catch (Exception error) {
            Toast.makeText(MainActivity.this, "Could not create PDF.", Toast.LENGTH_LONG).show();
        } finally {
            removeTemporaryWebView(webView);
            webView.destroy();
        }
    }

    private void removeTemporaryWebView(WebView webView) {
        try {
            if (webView.getParent() instanceof ViewGroup) {
                ((ViewGroup) webView.getParent()).removeView(webView);
            }
        } catch (Exception ignored) {
        }
    }

    private byte[] renderWebViewToPdfBytes(WebView webView, int widthMm, int heightMm) throws Exception {
        int pageWidthMm = widthMm > 0 ? widthMm : 210;
        int pageHeightMm = heightMm > 0 ? heightMm : 297;
        int pageWidthPoints = Math.max(1, Math.round(pageWidthMm * 72f / 25.4f));
        int pageHeightPoints = Math.max(1, Math.round(pageHeightMm * 72f / 25.4f));
        int viewWidthPx = mmToPx(pageWidthMm);
        int viewPageHeightPx = mmToPx(pageHeightMm);
        int contentHeightPx = Math.max(viewPageHeightPx, Math.round(webView.getContentHeight() * webView.getScale()));

        webView.measure(
            android.view.View.MeasureSpec.makeMeasureSpec(viewWidthPx, android.view.View.MeasureSpec.EXACTLY),
            android.view.View.MeasureSpec.makeMeasureSpec(contentHeightPx, android.view.View.MeasureSpec.EXACTLY)
        );
        webView.layout(0, 0, viewWidthPx, contentHeightPx);

        int pageCount = Math.max(1, (int) Math.ceil(contentHeightPx / (float) viewPageHeightPx));
        PdfDocument document = new PdfDocument();
        float translationX = webView.getTranslationX();
        float translationY = webView.getTranslationY();
        webView.setTranslationX(0f);
        webView.setTranslationY(0f);
        try {
            int outputPageNumber = 1;
            for (int pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
                Bitmap pageBitmap = Bitmap.createBitmap(viewWidthPx, viewPageHeightPx, Bitmap.Config.ARGB_8888);
                Canvas bitmapCanvas = new Canvas(pageBitmap);
                bitmapCanvas.drawColor(Color.WHITE);
                bitmapCanvas.translate(0, -pageIndex * viewPageHeightPx);
                webView.draw(bitmapCanvas);

                if (pageIndex > 0 && isBlankBitmap(pageBitmap)) {
                    pageBitmap.recycle();
                    continue;
                }

                PdfDocument.Page page = document.startPage(new PdfDocument.PageInfo.Builder(pageWidthPoints, pageHeightPoints, outputPageNumber).create());
                Canvas canvas = page.getCanvas();
                canvas.drawColor(Color.WHITE);
                RectF target = labelPageTargetRect(pageWidthMm, pageHeightMm, pageWidthPoints, pageHeightPoints);
                canvas.drawBitmap(pageBitmap, null, target, null);
                document.finishPage(page);
                pageBitmap.recycle();
                outputPageNumber += 1;
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.writeTo(output);
            return output.toByteArray();
        } finally {
            webView.setTranslationX(translationX);
            webView.setTranslationY(translationY);
            document.close();
        }
    }

    private boolean isBlankBitmap(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int step = Math.max(4, Math.min(width, height) / 90);
        int nonWhite = 0;
        int sampled = 0;

        for (int y = 0; y < height; y += step) {
            for (int x = 0; x < width; x += step) {
                int color = bitmap.getPixel(x, y);
                sampled += 1;
                if (Color.red(color) < 248 || Color.green(color) < 248 || Color.blue(color) < 248) {
                    nonWhite += 1;
                    if (nonWhite > Math.max(8, sampled / 350)) return false;
                }
            }
        }

        return true;
    }

    private RectF labelPageTargetRect(int widthMm, int heightMm, int pageWidthPoints, int pageHeightPoints) {
        if (widthMm == 34 && heightMm == 24) {
            float leftInsetPoints = 0.4f * 72f / 25.4f;
            float rightInsetPoints = 0.13f * 72f / 25.4f;
            return new RectF(leftInsetPoints, 0f, pageWidthPoints - rightInsetPoints, pageHeightPoints);
        }

        return new RectF(0f, 0f, pageWidthPoints, pageHeightPoints);
    }

    private int mmToPx(int mm) {
        return Math.max(Math.round(mm * 96f / 25.4f), 1);
    }

    private byte[] createLabelPdf(JSONArray labels) throws Exception {
        PdfDocument document = new PdfDocument();
        int width = Math.max(1, Math.round(34f * 72f / 25.4f));
        int height = Math.max(1, Math.round(24f * 72f / 25.4f));
        int count = Math.max(labels.length(), 1);

        try {
            for (int index = 0; index < count; index += 1) {
                JSONObject label = index < labels.length() ? labels.optJSONObject(index) : null;
                String dimensions = label == null ? "-" : label.optString("dimensions", "-");
                String customerName = label == null ? "-" : label.optString("customerName", "-");
                String contact = label == null ? "-" : label.optString("contact", "-");

                PdfDocument.Page page = document.startPage(new PdfDocument.PageInfo.Builder(width, height, index + 1).create());
                Canvas canvas = page.getCanvas();
                drawLabelPage(canvas, width, height, dimensions, customerName, contact);
                document.finishPage(page);
            }

            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.writeTo(output);
            return output.toByteArray();
        } finally {
            document.close();
        }
    }

    private void drawLabelPage(Canvas canvas, int width, int height, String dimensions, String customerName, String contact) {
        canvas.drawColor(Color.WHITE);

        Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(mmToPoints(0.26f));
        borderPaint.setColor(Color.rgb(203, 213, 225));
        float labelInset = mmToPoints(0.5f);
        float labelRadius = mmToPoints(1.5f);
        RectF border = new RectF(labelInset, labelInset, width - labelInset, height - labelInset);
        canvas.drawRoundRect(border, labelRadius, labelRadius, borderPaint);

        TextPaint dimensionPaint = createLabelTextPaint(pickLabelTextSize(dimensions, 15.2f, 10.8f), true);
        TextPaint customerPaint = createLabelTextPaint(pickLabelTextSize(customerName, 11.2f, 7.8f), true);
        TextPaint contactPaint = createLabelTextPaint(pickLabelTextSize(contact, 9.4f, 6.8f), true);
        dimensionPaint.setLetterSpacing(0.02f);
        contactPaint.setLetterSpacing(0.03f);

        float centerY = height / 2f;
        drawRotatedDashboardLabelText(canvas, dimensions, dimensionPaint, mmToPoints(4.0f), centerY);
        drawRotatedDashboardLabelText(canvas, customerName, customerPaint, mmToPoints(12.5f), centerY + mmToPoints(0.2f));
        drawRotatedDashboardLabelText(canvas, contact, contactPaint, mmToPoints(20.0f), centerY);
    }

    private float mmToPoints(float mm) {
        return mm * 72f / 25.4f;
    }

    private TextPaint createLabelTextPaint(float size, boolean bold) {
        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        paint.setColor(Color.rgb(15, 23, 42));
        paint.setTextSize(size);
        paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, bold ? Typeface.BOLD : Typeface.NORMAL));
        paint.setTextAlign(Paint.Align.LEFT);
        return paint;
    }

    private float pickLabelTextSize(String value, float baseSize, float minSize) {
        int length = value == null ? 0 : value.trim().length();
        if (length <= 10) return baseSize;
        if (length <= 14) return Math.max(baseSize - 1.0f, minSize);
        if (length <= 18) return Math.max(baseSize - 2.0f, minSize);
        if (length <= 24) return Math.max(baseSize - 3.0f, minSize);
        return minSize;
    }

    private void drawRotatedDashboardLabelText(Canvas canvas, String value, TextPaint paint, float centerX, float centerY) {
        String text = value == null || value.trim().isEmpty() ? "-" : value.trim();
        int layoutWidth = Math.max(1, Math.round(paint.measureText(text) + paint.getTextSize()));
        StaticLayout layout = createSingleLineLayout(text, paint, layoutWidth);

        canvas.save();
        canvas.translate(centerX, centerY);
        canvas.rotate(-90f);
        canvas.translate(-layoutWidth / 2f, -layout.getHeight() / 2f);
        layout.draw(canvas);
        canvas.restore();
    }

    @SuppressWarnings("deprecation")
    private StaticLayout createSingleLineLayout(String text, TextPaint paint, int availableWidth) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return StaticLayout.Builder
                .obtain(text, 0, text.length(), paint, availableWidth)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setMaxLines(1)
                .setEllipsize(TextUtils.TruncateAt.END)
                .setIncludePad(false)
                .build();
        }

        CharSequence ellipsized = TextUtils.ellipsize(text, paint, availableWidth, TextUtils.TruncateAt.END);
        return new StaticLayout(ellipsized, paint, availableWidth, Layout.Alignment.ALIGN_CENTER, 1f, 0f, false);
    }

    private byte[] createSimplePdf(String title, JSONArray lines) throws Exception {
        PdfDocument document = new PdfDocument();
        int width = 595;
        int height = 842;
        int margin = 42;
        int pageNumber = 1;
        PdfDocument.Page page = document.startPage(new PdfDocument.PageInfo.Builder(width, height, pageNumber).create());
        Canvas canvas = page.getCanvas();

        Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        titlePaint.setColor(Color.rgb(23, 79, 145));
        titlePaint.setTextSize(22);
        titlePaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        titlePaint.setTextAlign(Paint.Align.RIGHT);

        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.rgb(23, 32, 51));
        textPaint.setTextSize(13);
        textPaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
        textPaint.setTextAlign(Paint.Align.RIGHT);

        Paint mutedPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        mutedPaint.setColor(Color.rgb(93, 102, 119));
        mutedPaint.setTextSize(11);
        mutedPaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
        mutedPaint.setTextAlign(Paint.Align.RIGHT);

        Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(1.2f);
        borderPaint.setColor(Color.rgb(203, 213, 225));

        Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        fillPaint.setStyle(Paint.Style.FILL);
        fillPaint.setColor(Color.rgb(248, 250, 252));

        drawHeader(canvas, width, margin, title, titlePaint, mutedPaint);
        int y = 112;

        for (int i = 0; i < lines.length(); i++) {
            String line = lines.optString(i, "");
            if (line.trim().isEmpty()) continue;

            if (y > height - 78) {
                document.finishPage(page);
                pageNumber += 1;
                page = document.startPage(new PdfDocument.PageInfo.Builder(width, height, pageNumber).create());
                canvas = page.getCanvas();
                drawHeader(canvas, width, margin, title, titlePaint, mutedPaint);
                y = 112;
            }

            int boxTop = y - 24;
            int boxBottom = y + 20;
            RectF rect = new RectF(margin, boxTop, width - margin, boxBottom);
            canvas.drawRoundRect(rect, 10, 10, fillPaint);
            canvas.drawRoundRect(rect, 10, 10, borderPaint);
            canvas.drawText(line, width - margin - 14, y + 3, textPaint);
            y += 56;
        }

        if (lines.length() == 0) {
            canvas.drawText("موردی برای نمایش وجود ندارد", width - margin, y, textPaint);
        }

        document.finishPage(page);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        document.writeTo(output);
        document.close();
        return output.toByteArray();
    }

    private void drawHeader(Canvas canvas, int width, int margin, String title, Paint titlePaint, Paint mutedPaint) {
        canvas.drawColor(Color.WHITE);
        canvas.drawText(title, width - margin, 54, titlePaint);
        canvas.drawText("BEST Mobile", width - margin, 78, mutedPaint);
    }

    private String saveBytesFile(String safeName, byte[] bytes, String mimeType, boolean openAfterSave) {
        try {
            Uri savedUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Download destination is not available");

                try (OutputStream stream = resolver.openOutputStream(uri)) {
                    if (stream == null) throw new IllegalStateException("Download stream is not available");
                    stream.write(bytes);
                }

                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                savedUri = uri;
                notifyDownloadSaved(safeName, savedUri, mimeType, openAfterSave);
                return savedUri.toString();
            }

            File directory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Downloads directory is not available");
            File output = new File(directory, safeName);
            try (OutputStream stream = new FileOutputStream(output)) {
                stream.write(bytes);
            }
            MediaScannerConnection.scanFile(MainActivity.this, new String[] { output.getAbsolutePath() }, new String[] { mimeType }, null);
            savedUri = Uri.fromFile(output);
            notifyDownloadSaved(safeName, savedUri, mimeType, openAfterSave);
            return savedUri.toString();
        } catch (Exception error) {
            throw new RuntimeException("Could not save file: " + error.getMessage(), error);
        }
    }

    private void notifyDownloadSaved(String safeName, Uri uri, String mimeType, boolean openAfterSave) {
        runOnUiThread(() -> {
            Toast.makeText(MainActivity.this, "فایل در دانلودها ذخیره شد: " + safeName, Toast.LENGTH_LONG).show();
            if (!openAfterSave || uri == null) return;
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, mimeType);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(intent);
            } catch (ActivityNotFoundException error) {
                Toast.makeText(MainActivity.this, "PDF ذخیره شد؛ برنامه‌ای برای باز کردن PDF پیدا نشد.", Toast.LENGTH_LONG).show();
            } catch (Exception error) {
                Toast.makeText(MainActivity.this, "PDF ذخیره شد. از پوشه دانلودها باز کنید.", Toast.LENGTH_LONG).show();
            }
        });
    }

    private String sanitizeFilename(String filename) {
        String value = filename == null ? "best-export.txt" : filename.trim();
        if (value.isEmpty()) value = "best-export.txt";
        return value.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", "_");
    }
}
