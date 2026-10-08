using System.Runtime.InteropServices;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Traffic;

/// <summary>
/// An entirely separate, read-only SimConnect connection. It starts only
/// after an explicit GET from the opt-in browser layer and stops when idle.
/// Failures never touch the flight telemetry's separate SimConnect client.
/// </summary>
public sealed class SimTrafficMonitor(
    SimTrafficState state,ITelemetrySource telemetry,TelemetryHealth health,
    ILogger<SimTrafficMonitor> logger) : BackgroundService
{
    private const uint DefinitionId=0x70001000;
    private const uint FirstRequestId=0x70002000;
    private static readonly (string Name,string Unit)[] Fields=[
        ("PLANE LATITUDE","degrees"),
        ("PLANE LONGITUDE","degrees"),
        ("PLANE ALTITUDE","feet"),
        ("PLANE HEADING DEGREES TRUE","degrees"),
        ("GROUND VELOCITY","knots"),
        ("SIM ON GROUND","bool")
    ];
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        if(!OperatingSystem.IsWindows()||telemetry.Mode!="simconnect")return;
        while(!stop.IsCancellationRequested)
        {
            if(!state.Wanted||!health.Snapshot(telemetry.Mode).Connected)
            {
                state.Reset();
                await Task.Delay(TimeSpan.FromSeconds(2),stop);
                continue;
            }
            try{await MonitorSessionAsync(stop);}
            catch(OperationCanceledException) when(stop.IsCancellationRequested){break;}
            catch(Exception ex) when(ex is IOException or ExternalException or DllNotFoundException
                or EntryPointNotFoundException or BadImageFormatException)
            {
                state.Error();
                logger.LogDebug(ex,"MSFS SimObjectType provoz není dostupný.");
            }
            if(!stop.IsCancellationRequested)
                await Task.Delay(TimeSpan.FromSeconds(10),stop);
        }
    }

    private async Task MonitorSessionAsync(CancellationToken stop)
    {
        IntPtr handle=IntPtr.Zero;
        try
        {
            EnsureSuccess(Native.Open(out handle,"MSFS Companion Traffic",IntPtr.Zero,0,IntPtr.Zero,0));
            foreach(var field in Fields)
                EnsureSuccess(Native.AddDefinition(handle,DefinitionId,field.Name,field.Unit,4,0,uint.MaxValue));
            uint request=FirstRequestId;
            while(!stop.IsCancellationRequested&&state.Wanted&&
                health.Snapshot(telemetry.Mode).Connected)
            {
                state.Begin(++request);
                // Only aircraft, radius 100 km around MSFS own aircraft.
                // No AI create, writes, injection or multiplayer modification.
                EnsureSuccess(Native.RequestByType(handle,request,DefinitionId,100000,2));
                for(var tick=0;tick<160&&!stop.IsCancellationRequested;tick++)
                {
                    if(!state.Wanted||!health.Snapshot(telemetry.Mode).Connected)return;
                    for(var drain=0;drain<150;drain++)
                    {
                        var hr=Native.GetNext(handle,out var ptr,out var size);
                        if(hr==unchecked((int)0x80004005))break; // no message
                        if(hr<0)throw new IOException("SimConnect traffic dispatch failure.");
                        if(ptr==IntPtr.Zero||size<TrafficPacketDecoder.ExpectedBytes||
                            size>256)continue;
                        var copied=new byte[(int)size];
                        Marshal.Copy(ptr,copied,0,copied.Length);
                        if(TrafficPacketDecoder.TryDecode(copied,request,out var packet)&&packet is not null)
                            state.Accept(packet,DateTimeOffset.UtcNow);
                    }
                    await Task.Delay(50,stop);
                }
            }
        }
        finally
        {
            if(handle!=IntPtr.Zero)
            {
                try{Native.Close(handle);}catch(ExternalException){}
            }
        }
    }
    private static void EnsureSuccess(int result)
    {
        if(result<0)throw new IOException("SimConnect traffic native call failed: "+result);
    }

    private static class Native
    {
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_Open")]
        internal static extern int Open(out IntPtr handle,
            [MarshalAs(UnmanagedType.LPStr)]string name,IntPtr window,uint eventId,
            IntPtr eventHandle,uint configIndex);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_Close")]
        internal static extern int Close(IntPtr handle);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_AddToDataDefinition")]
        internal static extern int AddDefinition(IntPtr handle,uint definitionId,
            [MarshalAs(UnmanagedType.LPStr)]string simvar,
            [MarshalAs(UnmanagedType.LPStr)]string unit,uint type,float epsilon,uint datumId);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_RequestDataOnSimObjectType")]
        internal static extern int RequestByType(IntPtr handle,uint requestId,uint definitionId,
            uint radiusMeters,uint objectType);
        [DllImport("SimConnect.dll",EntryPoint="SimConnect_GetNextDispatch")]
        internal static extern int GetNext(IntPtr handle,out IntPtr packet,out uint size);
    }
}
