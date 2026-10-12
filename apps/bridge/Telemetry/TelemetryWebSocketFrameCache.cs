using System.Text.Json;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// Shared, process-local encoding of the newest immutable telemetry snapshot.
/// Several browser tabs consume the same bytes without N JSON serializations.
/// Only the last frame is retained; no unbounded client queue is introduced.
/// </summary>
public sealed class TelemetryWebSocketFrameCache
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    private readonly object _gate = new();
    private TelemetrySnapshot? _lastSnapshot;
    private byte[] _lastBytes = [];
    private long _encodedFrames;
    private long _cacheHits;
    private int _activeConnections;

    public byte[] Encode(TelemetrySnapshot snapshot)
    {
        lock (_gate)
        {
            if (ReferenceEquals(snapshot, _lastSnapshot))
            {
                _cacheHits++;
                return _lastBytes;
            }

            var bytes = JsonSerializer.SerializeToUtf8Bytes(snapshot, Options);
            _lastSnapshot = snapshot;
            _lastBytes = bytes;
            _encodedFrames++;
            return bytes;
        }
    }

    public void Connected() => Interlocked.Increment(ref _activeConnections);
    public void Disconnected() => Interlocked.Decrement(ref _activeConnections);

    public FrameCacheDiagnostics Status()
    {
        lock (_gate)
            return new FrameCacheDiagnostics(
                Math.Max(0, Volatile.Read(ref _activeConnections)),
                _encodedFrames, _cacheHits);
    }
}

public sealed record FrameCacheDiagnostics(int ActiveConnections, long EncodedFrames,
    long CacheHits);
