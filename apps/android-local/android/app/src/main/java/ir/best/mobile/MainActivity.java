package ir.best.mobile;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.ActivityNotFoundException;
import android.content.Intent;
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
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;

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
