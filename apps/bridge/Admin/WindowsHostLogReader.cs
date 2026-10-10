using System.Text;
using System.Text.RegularExpressions;

namespace MsfsCompanion.Bridge.Admin;

/// <summary>
/// Safe, bounded, read-only tail of the fixed Windows host log.
/// Never accepts a user supplied path and never returns raw diagnostic lines.
/// </summary>
public static class WindowsHostLogReader
{
    public const int MaximumLines = 300;
    public const int MaximumBytes = 128 * 1024;
    private const int MaximumLineCharacters = 900;

    public sealed record Snapshot(bool Available, bool Truncated,
        string[] Lines, DateTimeOffset GeneratedAt);

    public static string DefaultPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MSFS Companion", "windows-host.log");

    public static Snapshot Read(int requestedLines = 150) => ReadFile(DefaultPath, requestedLines);

    // Internal/test-only path injection. The HTTP API calls only Read().
    public static Snapshot ReadFile(string filePath, int requestedLines = 150)
    {
        var limit = Math.Clamp(requestedLines, 1, MaximumLines);
        try
        {
            using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read,
                FileShare.ReadWrite | FileShare.Delete);
            var skippedStart = stream.Length > MaximumBytes;
            if (skippedStart)
                stream.Seek(-MaximumBytes, SeekOrigin.End);
            using var reader = new StreamReader(stream, Encoding.UTF8,
                detectEncodingFromByteOrderMarks: true);
            var text = reader.ReadToEnd().Replace("\r\n", "\n");
            var entries = text.Split('\n');
            var begin = skippedStart ? 1 : 0; // remove partial first line
            var end = entries.Length > 0 && entries[^1].Length == 0
                ? entries.Length - 1 : entries.Length;
            var count = Math.Max(0, end - begin);
            var start = Math.Max(begin, end - limit);
            var lines = entries.Skip(start).Take(end - start)
                .Select(RedactLine).ToArray();
            return new Snapshot(true, skippedStart || count > limit,
                lines, DateTimeOffset.UtcNow);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException
                                       or ArgumentException or NotSupportedException)
        {
            return new Snapshot(false, false, [], DateTimeOffset.UtcNow);
        }
    }

    public static string RedactLine(string source)
    {
        // Limit each line before running regular expressions, to bound CPU and output.
        var text = source.Length > MaximumLineCharacters
            ? source[..MaximumLineCharacters] + "… [řádek zkrácen]" : source;
        try
        {
            text = Regex.Replace(text,
                @"(?i)\b(Authorization\s*[:=]\s*Bearer\s+)[^\s&;,]+",
                "$1[SKRYTO]", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text,
                @"(?i)\b(Bearer\s+)[A-Za-z0-9._~+/\-=]+",
                "$1[SKRYTO]", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text,
                @"(?i)\b((?:access_token|refresh_token|api[_-]?key|password|secret|token|authorization|client_secret|signature|sig)\s*[:=]\s*)[^\s&;,]+",
                "$1[SKRYTO]", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text,
                @"(?i)([?&](?:access_token|refresh_token|api[_-]?key|password|secret|token|authorization|client_secret|signature|sig)=)[^&#\s]+",
                "$1[SKRYTO]", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text,
                @"(?i)\b[A-Z]:\\Users\\[^\\\s]+",
                @"C:\Users\[UŽIVATEL]", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text,
                @"(?i)/Users/[^/\s]+",
                "/Users/[UŽIVATEL]", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text,
                @"(?i)\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b",
                "[E-MAIL]", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text,
                @"\b(?:\d{1,3}\.){3}\d{1,3}\b",
                "[IP]", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
            return text;
        }
        catch (RegexMatchTimeoutException)
        {
            return "[ŘÁDEK VYNECHÁN: náročný vstup]";
        }
    }
}
