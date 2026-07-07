package ir.best.mobile;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

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

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, safeMime);
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
                    return uri.toString();
                }

                File directory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Downloads directory is not available");
                File output = new File(directory, safeName);
                try (OutputStream stream = new FileOutputStream(output)) {
                    stream.write(bytes);
                }
                MediaScannerConnection.scanFile(MainActivity.this, new String[] { output.getAbsolutePath() }, new String[] { safeMime }, null);
                return Uri.fromFile(output).toString();
            } catch (Exception error) {
                throw new RuntimeException("Could not save file: " + error.getMessage(), error);
            }
        }
    }

    private String sanitizeFilename(String filename) {
        String value = filename == null ? "best-export.txt" : filename.trim();
        if (value.isEmpty()) value = "best-export.txt";
        return value.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", "_");
    }
}
