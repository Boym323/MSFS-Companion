using MsfsCompanion.Bridge.Aircraft;

namespace MsfsCompanion.Bridge.Airbus;

public sealed record A320EngineSnapshot(DateTimeOffset TimestampUtc,
    double N1Engine1,double N1Engine2,double N2Engine1,double N2Engine2,
    double FuelFlowPph1,double FuelFlowPph2);

public sealed record A320AuxSnapshot(DateTimeOffset TimestampUtc,
    double ApuRpmPercent,bool ApuGeneratorActive,double FuelTotalWeightPounds);

public sealed record A320FcuSnapshot(DateTimeOffset TimestampUtc,
    double SelectedSpeedKnots,double SelectedMach,double SelectedHeadingDegrees,
    double SelectedAltitudeFeet,double SelectedVerticalSpeedFpm,
    int SpeedSlotIndex,int HeadingSlotIndex,int AltitudeSlotIndex,
    int VerticalSpeedSlotIndex,bool AutopilotMaster,
    string Verification);

/// <summary>
/// Separate immutable 1Hz snapshots. Unavailable/old values are never
/// interpreted as engine off, autopilot off, or an Airbus FMA state.
/// </summary>
public sealed class A320ReadbackStore
{
    private A320EngineSnapshot? _engines;
    private A320FcuSnapshot? _fcu;
    private A320AuxSnapshot? _aux;
    // A320 control commands require a fresh, valid 1Hz FCU snapshot.
    // Never use a last-known or invalid reference to authorize writes.
    public A320FcuSnapshot? FreshFcu(DateTimeOffset now)
    {
        var value = Volatile.Read(ref _fcu);
        return value is not null &&
            now >= value.TimestampUtc &&
            now - value.TimestampUtc < TimeSpan.FromSeconds(3) ? value : null;
    }

    public void Reset()
    {
        Interlocked.Exchange(ref _engines,null);
        Interlocked.Exchange(ref _fcu,null);
        Interlocked.Exchange(ref _aux,null);
    }

    public void UpdateEngines(A320SimConnectEngineData data,DateTimeOffset at)
    {
        if(!data.IsValid())return;
        Interlocked.Exchange(ref _engines,new A320EngineSnapshot(at,
            data.N1Engine1,data.N1Engine2,data.N2Engine1,data.N2Engine2,
            data.FuelFlowPph1,data.FuelFlowPph2));
    }

    public void UpdateAux(A320SimConnectAuxData data,DateTimeOffset at)
    {
        if(!data.IsValid())return;
        Interlocked.Exchange(ref _aux,new A320AuxSnapshot(at,
            data.ApuRpmPercent,data.ApuGeneratorActive>0.5,
            data.FuelTotalWeightPounds));
    }

    public void UpdateFcu(A320SimConnectFcuData data,DateTimeOffset at)
    {
        if(!data.IsValid())return;
        Interlocked.Exchange(ref _fcu,new A320FcuSnapshot(at,
            data.SelectedSpeedKnots,data.SelectedMach,
            (data.SelectedHeadingDegrees%360+360)%360,
            data.SelectedAltitudeFeet,data.SelectedVerticalSpeedFpm,
            (int)data.SpeedSlotIndex,(int)data.HeadingSlotIndex,
            (int)data.AltitudeSlotIndex,(int)data.VerticalSpeedSlotIndex,
            data.AutopilotMaster>0.5,"generic_simvars_unverified_fma"));
    }

    public object Status(string? title,bool trusted,DateTimeOffset at)
    {
        var profile=AircraftProfileResolver.Resolve(title);
        // Only the Asobo-candidate read-only profile uses these values.
        var supported=trusted&&profile.Id=="a320-asobo-candidate";
        var e=Volatile.Read(ref _engines);
        var f=Volatile.Read(ref _fcu);
        var aux=Volatile.Read(ref _aux);
        double? Age(DateTimeOffset? timestamp)=>timestamp is { } seen
            ?Math.Max(0,(at-seen).TotalMilliseconds):null;
        var engineAge=Age(e?.TimestampUtc);
        var fcuAge=Age(f?.TimestampUtc);
        var auxAge=Age(aux?.TimestampUtc);
        return new {
            connected=supported,aircraft= supported?title:null,profileId=profile.Id,
            verifiedAircraft=false,mode="read_only",fmaVerified=false,
            engines=supported&&engineAge is < 6000?e:null,
            fcu=supported&&fcuAge is < 6000?f:null,
            aux=supported&&auxAge is < 6000?aux:null,
            enginesAgeMs=supported&&engineAge is < 6000?engineAge:null,
            fcuAgeMs=supported&&fcuAge is < 6000?fcuAge:null,
            auxAgeMs=supported&&auxAge is < 6000?auxAge:null,
            warning="Obecné SimVars nejsou potvrzením Airbus FCU/FMA; ověřte hodnoty v MSFS 2020."
        };
    }
}
