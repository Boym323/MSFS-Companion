using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;

namespace MsfsCompanion.WindowsHost;

/// <summary>
/// Local-only, opt-in installation of Kokpit's bundled MSFS 2020 WASM package.
/// Never downloads, installs third-party packages, or writes while MSFS runs.
/// Only our own marker-owned, inventory-validated package may be replaced.
/// </summary>
internal static class A320ModuleInstaller
{
    public const string PackageName = "kokpit-asobo-a320-v1";
    private const string Owner = "Boym323/MSFS-Companion";
    private const string MarkerName = ".kokpit-managed.json";
    private static readonly string[] Payload =
    [
        "manifest.json", "layout.json", "modules/kokpit-a320.wasm"
    ];

    private sealed record Marker(string Owner, string Package, string Sha256);
    internal static string BundledFolder => Path.Combine(AppContext.BaseDirectory,
        "a320-module", PackageName);

    public static bool SimulatorRunning()
    {
        try
        {
            // Both MSFS 2020 and some MSFS 2024 installations use this
            // process name. Conservatively block writes while either runs.
            foreach (var name in new[] { "FlightSimulator", "FlightSimulator2024" })
            {
                using var process = Process.GetProcessesByName(name).FirstOrDefault();
                if (process is not null) return true;
            }
            return false;
        }
        catch { return true; } // Fail closed when process enumeration fails.
    }

    public static string? DetectCommunity()
    {
        var roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var configs = new[]
        {
            Path.Combine(roaming, "Microsoft Flight Simulator", "UserCfg.opt"),
            Path.Combine(local, "Packages", "Microsoft.FlightSimulator_8wekyb3d8bbwe",
                "LocalCache", "UserCfg.opt"),
            Path.Combine(local, "Microsoft Flight Simulator", "UserCfg.opt")
        };
        foreach (var file in configs)
        {
            try
            {
                if (!File.Exists(file)) continue;
                foreach (var line in File.ReadLines(file))
                {
                    var trimmed = line.Trim();
                    const string key = "InstalledPackagesPath";
                    if (!trimmed.StartsWith(key, StringComparison.OrdinalIgnoreCase))
                        continue;
                    var value = trimmed[key.Length..].Trim().Trim('"');
                    if (string.IsNullOrWhiteSpace(value)) continue;
                    var community = Path.Combine(value, "Community");
                    if (ValidCommunity(community)) return Path.GetFullPath(community);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException
                or ArgumentException or NotSupportedException) { /* Next known config */ }
        }
        return null;
    }

    public static bool ValidCommunity(string? path)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path)) return false;
            var full = Path.GetFullPath(path);
            if (!Directory.Exists(full) ||
                !string.Equals(Path.GetFileName(Path.TrimEndingDirectorySeparator(full)),
                    "Community", StringComparison.OrdinalIgnoreCase)) return false;
            // Reparse points are not followed into unknown folders.
            if ((File.GetAttributes(full) & FileAttributes.ReparsePoint) != 0)
                return false;
            return true;
        }
        catch { return false; }
    }

    private static bool IsReparse(string path) =>
        (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;

    private static string BinaryHash(string path) =>
        Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path)));

    private static bool ValidateBundle(string source, out string sha)
    {
        sha = "";
        try
        {
            foreach (var rel in Payload)
            {
                var full = Path.Combine(source, rel.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(full) || IsReparse(full)) return false;
            }
            var binary = Path.Combine(source, "modules", "kokpit-a320.wasm");
            var info = new FileInfo(binary);
            if (info.Length < 4096 || info.Length > 32 * 1024 * 1024) return false;
            using (var stream = File.OpenRead(binary))
            {
                var magic = new byte[8];
                if (stream.Read(magic) != 8 || !magic.AsSpan().SequenceEqual(
                    new byte[] { 0, 97, 115, 109, 1, 0, 0, 0 })) return false;
            }
            using var manifest = JsonDocument.Parse(File.ReadAllText(
                Path.Combine(source, "manifest.json")));
            if (manifest.RootElement.GetProperty("title").GetString() !=
                "Kokpit Asobo A320neo H-Event Module") return false;
            using var layout = JsonDocument.Parse(File.ReadAllText(
                Path.Combine(source, "layout.json")));
            if (layout.RootElement.GetArrayLength() != 1) return false;
            var element = layout.RootElement[0];
            if (element.GetProperty("path").GetString() != "modules/kokpit-a320.wasm" ||
                element.GetProperty("size").GetInt64() != info.Length) return false;
            sha = BinaryHash(binary);
            return true;
        }
        catch { return false; }
    }

    private static bool OnlyOwnedFiles(string target)
    {
        try
        {
            if (IsReparse(target)) return false;
            var modules = Path.Combine(target, "modules");
            if (!Directory.Exists(modules) || IsReparse(modules)) return false;
            // Never recursively enumerate a folder before checking its exact
            // shape: an unexpected junction could escape the Community root.
            var dirs = Directory.EnumerateDirectories(target, "*",
                SearchOption.TopDirectoryOnly).ToList();
            if (dirs.Count != 1 ||
                !string.Equals(Path.GetFileName(dirs[0]), "modules",
                    StringComparison.OrdinalIgnoreCase)) return false;
            var rootFiles = Directory.EnumerateFiles(target, "*",
                SearchOption.TopDirectoryOnly).ToList();
            var moduleFiles = Directory.EnumerateFiles(modules, "*",
                SearchOption.TopDirectoryOnly).ToList();
            if (rootFiles.Count != 3 || moduleFiles.Count != 1) return false;
            var rootAllowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "manifest.json", "layout.json", MarkerName };
            if (!rootFiles.All(x => rootAllowed.Contains(Path.GetFileName(x))) ||
                Path.GetFileName(moduleFiles[0]) != "kokpit-a320.wasm") return false;
            return rootFiles.Concat(moduleFiles).All(x => !IsReparse(x));
        }
        catch { return false; }
    }

    private static bool Owned(string target)
    {
        try
        {
            if (!Directory.Exists(target) || !OnlyOwnedFiles(target)) return false;
            var mark = JsonSerializer.Deserialize<Marker>(File.ReadAllText(
                Path.Combine(target, MarkerName)));
            return mark?.Owner == Owner && mark.Package == PackageName;
        }
        catch { return false; }
    }

    public static string Status(string? community)
    {
        if (!File.Exists(Path.Combine(BundledFolder, "modules", "kokpit-a320.wasm")))
            return "Modul není přibalen k této verzi Kokpitu.";
        if (!ValidCommunity(community)) return "Složka MSFS 2020 Community nenalezena.";
        var destination = Path.Combine(community!, PackageName);
        if (!Directory.Exists(destination)) return "Modul není nainstalován.";
        if (!Owned(destination)) return "Cílovou složku nelze bezpečně spravovat.";
        if (!ValidateBundle(BundledFolder, out var sha)) return "Neplatný instalační balíček.";
        var mark = JsonSerializer.Deserialize<Marker>(File.ReadAllText(
            Path.Combine(destination, MarkerName)));
        return mark?.Sha256 == sha &&
            BinaryHash(Path.Combine(destination, "modules", "kokpit-a320.wasm")) == sha
            ? "Modul je aktuální." : "Je dostupná aktualizace modulu.";
    }

    public static bool Install(string community, out string message) =>
        InstallFromSource(BundledFolder, community, SimulatorRunning(), out message);

    internal static bool InstallFromSource(string source, string community,
        bool simulatorRunning, out string message)
    {
        message = "";
        if (simulatorRunning)
        {
            message = "MSFS je spuštěný. Instalaci odložte až po jeho ukončení.";
            return false;
        }
        if (!ValidCommunity(community))
        {
            message = "Neplatná nebo přesměrovaná složka Community.";
            return false;
        }
        if (!ValidateBundle(source, out var sha))
        {
            message = "Chybí platný, SDK sestavený modul v instalaci Kokpitu.";
            return false;
        }
        var target = Path.Combine(community, PackageName);
        if (Directory.Exists(target) && !Owned(target))
        {
            message = "Cílová složka existuje, ale není výhradně spravována Kokpitem. Nic nebylo přepsáno.";
            return false;
        }
        if (Directory.Exists(target))
        {
            var current = JsonSerializer.Deserialize<Marker>(File.ReadAllText(
                Path.Combine(target, MarkerName)));
            if (current?.Sha256 == sha &&
                BinaryHash(Path.Combine(target, "modules", "kokpit-a320.wasm")) == sha)
            {
                message = "Modul je již aktuální.";
                return true;
            }
        }

        var stage = Path.Combine(community, ".kokpit-a320-stage-" + Guid.NewGuid().ToString("N"));
        var backup = Path.Combine(community, ".kokpit-a320-backup-" + Guid.NewGuid().ToString("N"));
        var hadTarget = Directory.Exists(target);
        var movedTarget = false;
        try
        {
            Directory.CreateDirectory(Path.Combine(stage, "modules"));
            foreach (var rel in Payload)
                File.Copy(Path.Combine(source, rel.Replace('/', Path.DirectorySeparatorChar)),
                    Path.Combine(stage, rel.Replace('/', Path.DirectorySeparatorChar)));
            File.WriteAllText(Path.Combine(stage, MarkerName), JsonSerializer.Serialize(
                new Marker(Owner, PackageName, sha)));
            if (!Owned(stage)) throw new IOException("Staged module failed integrity check.");
            if (hadTarget)
            {
                Directory.Move(target, backup);
                movedTarget = true;
            }
            Directory.Move(stage, target);
            if (BinaryHash(Path.Combine(target, "modules", "kokpit-a320.wasm")) != sha)
                throw new IOException("Installed module hash mismatch.");
            if (movedTarget) Directory.Delete(backup, recursive: true);
            message = hadTarget ? "Modul A320 byl bezpečně aktualizován." :
                "Modul A320 byl nainstalován. Spusťte znovu MSFS 2020.";
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            try
            {
                if (Directory.Exists(target) && Owned(target))
                    Directory.Delete(target, recursive: true);
                if (movedTarget && Directory.Exists(backup) && !Directory.Exists(target))
                    Directory.Move(backup, target);
            }
            catch { /* Keep backup on disk for manual recovery. */ }
            message = "Instalace selhala; původní modul byl pokud možno obnoven. " +
                ex.GetType().Name;
            return false;
        }
        finally
        {
            try { if (Directory.Exists(stage) && !IsReparse(stage))
                Directory.Delete(stage, recursive: true); }
            catch (Exception ex) { EventLogFile.Write("A320 staging cleanup: " + ex.GetType().Name); }
        }
    }

    public static bool Uninstall(string community, out string message)
    {
        if (SimulatorRunning())
        {
            message = "Nejdřív ukončete MSFS.";
            return false;
        }
        if (!ValidCommunity(community))
        {
            message = "Neplatná složka Community.";
            return false;
        }
        var target = Path.Combine(community, PackageName);
        if (!Directory.Exists(target))
        {
            message = "Modul už není nainstalován.";
            return true;
        }
        if (!Owned(target))
        {
            message = "Složka není spravovaná Kokpitem; nic se nemaže.";
            return false;
        }
        try
        {
            Directory.Delete(target, recursive: true);
            message = "Modul A320 byl odinstalován. Restartujte MSFS.";
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            message = "Odinstalace selhala: " + ex.GetType().Name;
            return false;
        }
    }

    public static bool SelfTest()
    {
        var temp = Path.Combine(Path.GetTempPath(), "kokpit-a320-" + Guid.NewGuid().ToString("N"));
        try
        {
            var source = Path.Combine(temp, "source");
            var community = Path.Combine(temp, "Community");
            Directory.CreateDirectory(Path.Combine(source, "modules"));
            Directory.CreateDirectory(community);
            var binary = new byte[4096];
            new byte[] { 0, 97, 115, 109, 1, 0, 0, 0 }.CopyTo(binary, 0);
            var src = Path.Combine(source, "modules", "kokpit-a320.wasm");
            File.WriteAllBytes(src, binary);
            File.WriteAllText(Path.Combine(source, "manifest.json"),
                JsonSerializer.Serialize(new { title = "Kokpit Asobo A320neo H-Event Module" }));
            File.WriteAllText(Path.Combine(source, "layout.json"),
                JsonSerializer.Serialize(new[] { new { path = "modules/kokpit-a320.wasm", size = 4096 } }));
            var ok = !InstallFromSource(source, community, true, out _);
            ok &= InstallFromSource(source, community, false, out _);
            ok &= InstallFromSource(source, community, false, out _);
            var target = Path.Combine(community, PackageName);
            ok &= Owned(target);
            binary[100] = 12;
            File.WriteAllBytes(src, binary);
            ok &= InstallFromSource(source, community, false, out _);
            ok &= File.ReadAllBytes(Path.Combine(target, "modules", "kokpit-a320.wasm"))[100] == 12;
            // Refuse to overwrite a directory with unexpected files.
            File.WriteAllText(Path.Combine(target, "unrelated.txt"), "preserve");
            ok &= !InstallFromSource(source, community, false, out _);
            ok &= File.Exists(Path.Combine(target, "unrelated.txt"));
            File.Delete(Path.Combine(target, "unrelated.txt"));
            // Refuse to overwrite a folder without ownership marker.
            File.Delete(Path.Combine(target, MarkerName));
            ok &= !InstallFromSource(source, community, false, out _);
            Console.WriteLine(ok ? "A320 Community installer self-test PASS" :
                "A320 Community installer self-test FAIL");
            return ok;
        }
        catch (Exception ex)
        {
            Console.WriteLine("A320 Community installer self-test FAIL: " + ex);
            return false;
        }
        finally
        {
            if (Directory.Exists(temp)) Directory.Delete(temp, recursive: true);
        }
    }
}
