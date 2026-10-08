using System.Security.Cryptography;
using System.Net;

namespace MsfsCompanion.Bridge.Controls;

/// <summary>
/// Párování je ve výchozím stavu vypnuto, ovládání v důvěryhodné LAN povoleno.
/// Párovací kód smí zobrazit pouze
/// browser na Windows hostiteli (loopback), nikdy zařízení v LAN.
/// Tokeny jsou pouze v paměti; při restartu či vypnutí se zneplatní.
/// </summary>
public sealed class ControlAccess
{
    private readonly object _gate = new();
    private readonly Dictionary<string, DateTimeOffset> _tokens = new(StringComparer.Ordinal);
    private bool _enabled;
    private string _code = "";
    private DateTimeOffset _codeExpires;
    private DateTimeOffset _attemptWindow;
    private int _attemptCount;
    private DateTimeOffset _lastCommand;

    /// <summary>Znamená, že je zapnuté bezpečnostní párování (nikoliv samotné ovládání).</summary>
    public bool Enabled { get { lock (_gate) return _enabled; } }

    public bool CanControl(string? token) => !Enabled || Authorized(token);

    public void SetEnabled(bool enabled)
    {
        lock (_gate)
        {
            _enabled = enabled;
            _tokens.Clear();
            _code = "";
            _codeExpires = DateTimeOffset.MinValue;
            _attemptWindow = DateTimeOffset.MinValue;
            _attemptCount = 0;
            _lastCommand = DateTimeOffset.MinValue;
        }
    }

    public string? LocalPairCode()
    {
        lock (_gate)
        {
            if (!_enabled) return null;
            if (DateTimeOffset.UtcNow >= _codeExpires)
            {
                _code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
                _codeExpires = DateTimeOffset.UtcNow.AddMinutes(3);
            }
            return _code;
        }
    }

    public string? Pair(string? code)
    {
        lock (_gate)
        {
            if (!_enabled || string.IsNullOrEmpty(code)) return null;
            var now = DateTimeOffset.UtcNow;
            if (now >= _attemptWindow)
            {
                _attemptWindow = now.AddMinutes(3);
                _attemptCount = 0;
            }
            if (++_attemptCount > 8 || now >= _codeExpires || code.Length != 6)
                return null;
            if (!CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.ASCII.GetBytes(code),
                    System.Text.Encoding.ASCII.GetBytes(_code)))
                return null;
            // Kód je na jedno použití. Pro další iPad se vydá nový.
            _code = "";
            _codeExpires = DateTimeOffset.MinValue;
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            _tokens[TokenHash(token)] = now.AddHours(8);
            return token;
        }
    }

    public bool Authorized(string? token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length != 64) return false;
        lock (_gate)
        {
            if (!_enabled) return false;
            var hash = TokenHash(token);
            if (!_tokens.TryGetValue(hash, out var until)) return false;
            if (until > DateTimeOffset.UtcNow) return true;
            _tokens.Remove(hash);
            return false;
        }
    }

    public bool PermitCommand(string? token)
    {
        lock (_gate)
        {
            if (!CanControl(token)) return false;
            var now = DateTimeOffset.UtcNow;
            if ((now - _lastCommand).TotalMilliseconds < 250) return false;
            _lastCommand = now;
            return true;
        }
    }

    private static string TokenHash(string token) =>
        Convert.ToHexString(SHA256.HashData(System.Text.Encoding.ASCII.GetBytes(token)));

    public static bool IsLoopback(HttpContext context) =>
        context.Connection.RemoteIpAddress is IPAddress remote && IPAddress.IsLoopback(remote);

    public static bool SameOrigin(HttpContext context) =>
        Uri.TryCreate(context.Request.Headers.Origin.ToString(), UriKind.Absolute, out var origin)
        && origin.Scheme == context.Request.Scheme
        && origin.Authority.Equals(context.Request.Host.Value, StringComparison.OrdinalIgnoreCase)
        && origin.AbsolutePath == "/"
        && origin.Query.Length == 0
        && origin.Fragment.Length == 0;
}
