using SimConnect.NET;
using SimConnect.NET.InputEvents;

namespace MsfsCompanion.Bridge.Avionics;

public sealed record G1000Availability(string Status, string? Aircraft, DateTimeOffset? CheckedAt,
    IReadOnlyList<string> AvailableActions, string? Error);

/// <summary>Samostatné (lazy) SimConnect spojení jen pro Input Events, nemění B2 hot path.</summary>
public sealed class G1000Service : IAsyncDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private SimConnectClient? _client;
    private Dictionary<string, InputEventDescriptor> _events = new(StringComparer.Ordinal);
    private string? _aircraft;
    private DateTimeOffset _checkedAt;
    private string _status = "not_scanned";
    private string? _error;

    public async Task<G1000Availability> StatusAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (_client is null || !_client.IsConnected ||
                DateTimeOffset.UtcNow - _checkedAt > TimeSpan.FromSeconds(30))
                await ScanLockedAsync(ct);

            return new G1000Availability(_status, _aircraft,
                _checkedAt == default ? null : _checkedAt,
                G1000Catalog.All.Where(a => (_events.ContainsKey(a.InputEvent) || a.AlternateInputEvent is not null && _events.ContainsKey(a.AlternateInputEvent))).Select(a => a.Id).ToArray(), _error);
        }
        finally { _gate.Release(); }
    }

    public async Task<bool> SendAsync(string id, double value, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            // Re-scan before commands when stale, disconnected, or aircraft switched.
            if (_client is null || !_client.IsConnected ||
                DateTimeOffset.UtcNow - _checkedAt > TimeSpan.FromSeconds(30))
                await ScanLockedAsync(ct);
            if (_client is null || _status != "ready") return false;

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(5));
            var currentAircraft = await _client.SimVars.GetAsync<string>("TITLE", "",
                cancellationToken: timeout.Token);
            if (currentAircraft != _aircraft)
            {
                await ScanLockedAsync(ct);
                return false; // před prvním povelem po změně letadla znovu načíst UI
            }

            var action = G1000Catalog.All.FirstOrDefault(x => x.Id == id);
            if (action is null) return false;
            if (!_events.TryGetValue(action.InputEvent, out var descriptor)
                && (action.AlternateInputEvent is null
                    || !_events.TryGetValue(action.AlternateInputEvent, out descriptor)))
                return false;
            await _client.InputEvents.SetInputEventAsync(descriptor.Hash, value, timeout.Token);
            return true; // jen odesláno, ne potvrzeno
        }
        catch
        {
            await CloseLockedAsync();
            throw;
        }
        finally { _gate.Release(); }
    }

    private async Task ScanLockedAsync(CancellationToken ct)
    {
        _events.Clear();
        _status = "unavailable";
        _error = null;
        _checkedAt = DateTimeOffset.UtcNow;
        if (!OperatingSystem.IsWindows())
        {
            _status = "windows_only";
            return;
        }

        try
        {
            if (_client is null || !_client.IsConnected)
            {
                await CloseLockedAsync();
                _client = new SimConnectClient("MSFS Companion G1000 Input Events")
                    { AutoReconnectEnabled = false };
                using var connect = CancellationTokenSource.CreateLinkedTokenSource(ct);
                connect.CancelAfter(TimeSpan.FromSeconds(5));
                await _client.ConnectAsync(cancellationToken: connect.Token);
            }
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(8));
            _aircraft = await _client.SimVars.GetAsync<string>("TITLE", "",
                cancellationToken: timeout.Token);
            var discovered = await _client.InputEvents.EnumerateInputEventsAsync(timeout.Token);
            // Nikdy bez enumerace nepovolovat žádný aktuátor.
            _events = discovered.Where(x => G1000Catalog.All.Any(a => a.InputEvent == x.Name || a.AlternateInputEvent == x.Name))
                .GroupBy(x => x.Name, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
            _status = _events.Count > 0 ? "ready" : "unsupported";
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            _status = "unavailable";
            _error = ex.GetType().Name;
            await CloseLockedAsync();
        }
        _checkedAt = DateTimeOffset.UtcNow;
    }

    private async Task CloseLockedAsync()
    {
        if (_client is not null)
        {
            await _client.DisposeAsync();
            _client = null;
        }
        _events.Clear();
    }

    public async ValueTask DisposeAsync()
    {
        await _gate.WaitAsync();
        try { await CloseLockedAsync(); }
        finally { _gate.Release(); _gate.Dispose(); }
    }
}
