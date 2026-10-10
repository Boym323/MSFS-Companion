using MsfsCompanion.Bridge.Admin;

static void Check(bool pass, string why)
{
    if (!pass) throw new Exception(why);
}

var file = Path.Combine(Path.GetTempPath(), "kokpit-host-log-test-" +
    Guid.NewGuid().ToString("N") + ".log");
try
{
    var missing = WindowsHostLogReader.ReadFile(file);
    Check(!missing.Available && missing.Lines.Length == 0, "missing log");
    var raw = string.Join('\n', new[]
    {
        "[2026-10-10] Bridge started, PID 1234",
        @"Token=secret-value Authorization:Bearer abc.def.ghi",
        @"GET /?access_token=should-not-leak&other=1",
        @"C:\Users\PrivateName\AppData\Local\Something 192.168.1.5 name@example.com",
        "[2026-10-10] Bridge error: SimConnect disconnected",
        "[2026-10-10] Bridge restarted"
    });
    File.WriteAllText(file, raw + "\n");

    var result = WindowsHostLogReader.ReadFile(file, 3);
    Check(result.Available && result.Truncated && result.Lines.Length == 3,
        "last three log lines");
    Check(result.Lines[0].Contains(@"C:\Users\[UŽIVATEL]"),
        "Windows username must be redacted");
    Check(result.Lines[0].Contains("[IP]") && result.Lines[0].Contains("[E-MAIL]"),
        "IP/email must be redacted");

    var full = WindowsHostLogReader.ReadFile(file, 99);
    Check(full.Lines.Length == 6 && !full.Truncated, "full file");
    Check(full.Lines[1].Contains("Token=[SKRYTO]") &&
          full.Lines[1].Contains("Bearer [SKRYTO]") &&
          !full.Lines[1].Contains("secret-value"), "auth redaction");
    Check(full.Lines[2].Contains("access_token=[SKRYTO]") &&
          !full.Lines[2].Contains("should-not-leak"), "query redaction");

    // The web reader must not block the concurrently writing host.
    using (var stream = new FileStream(file, FileMode.Append, FileAccess.Write,
               FileShare.ReadWrite | FileShare.Delete))
    {
        var concurrent = WindowsHostLogReader.ReadFile(file, 200);
        Check(concurrent.Available, "read during host write");
    }
    File.WriteAllText(file, new string('X', 200_000) +
        "\n[2026-10-10] Warning: Last log line\n");
    var tail = WindowsHostLogReader.ReadFile(file, 9999);
    Check(tail.Available && tail.Truncated &&
          tail.Lines.Length == 1 &&
          tail.Lines[0].Contains("Last log line"),
        "128 KiB tail boundary and max-lines clamp");

    Check(WindowsHostLogReader.RedactLine(new string('Z', 30_000)).Length < 1000,
        "per-line CPU/output bound");
    Console.WriteLine("PASS: bounded log tail, concurrent writes, secrets and usernames masked.");
}
finally
{
    if (File.Exists(file)) File.Delete(file);
}
