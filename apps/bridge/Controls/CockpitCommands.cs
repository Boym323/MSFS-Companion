namespace MsfsCompanion.Bridge.Controls;

public sealed record ControlCommand(string Command, double? Value);
public sealed record MappedCockpitEvent(string Name, uint Data);

/// <summary>Jediný povolený překlad API příkazů na oficiální SimConnect Key Events.</summary>
public static class CockpitCommands
{
    private static readonly Dictionary<string, string> Switches = new(StringComparer.Ordinal)
    {
        ["radio.com1.swap"] = "COM1_RADIO_SWAP",
        ["radio.com2.swap"] = "COM2_RADIO_SWAP",
        ["radio.nav1.swap"] = "NAV1_RADIO_SWAP",
        ["radio.nav2.swap"] = "NAV2_RADIO_SWAP",
        ["autopilot.on"] = "AUTOPILOT_ON",
        ["autopilot.off"] = "AUTOPILOT_OFF",
        ["autopilot.hdg.on"] = "AP_HDG_HOLD_ON",
        ["autopilot.hdg.off"] = "AP_HDG_HOLD_OFF",
        ["autopilot.nav.on"] = "AP_NAV1_HOLD_ON",
        ["autopilot.nav.off"] = "AP_NAV1_HOLD_OFF",
        ["autopilot.alt.on"] = "AP_ALT_HOLD_ON",
        ["autopilot.alt.off"] = "AP_ALT_HOLD_OFF",
        ["autopilot.vs.on"] = "AP_VS_ON",
        ["autopilot.vs.off"] = "AP_VS_OFF",
        ["lights.landing.on"] = "LANDING_LIGHTS_ON",
        ["lights.landing.off"] = "LANDING_LIGHTS_OFF",
        ["lights.taxi.on"] = "TAXI_LIGHTS_ON",
        ["lights.taxi.off"] = "TAXI_LIGHTS_OFF",
        ["lights.nav.on"] = "NAV_LIGHTS_ON",
        ["lights.nav.off"] = "NAV_LIGHTS_OFF",
        ["lights.beacon.on"] = "BEACON_LIGHTS_ON",
        ["lights.beacon.off"] = "BEACON_LIGHTS_OFF",
        ["lights.strobe.on"] = "STROBES_ON",
        ["lights.strobe.off"] = "STROBES_OFF",
        ["pitot.on"] = "PITOT_HEAT_ON",
        ["pitot.off"] = "PITOT_HEAT_OFF",
        ["gear.down"] = "GEAR_DOWN",
        ["gear.up"] = "GEAR_UP",
        ["flaps.up"] = "FLAPS_UP",
        ["flaps.down"] = "FLAPS_DOWN",
        ["flaps.increment"] = "FLAPS_INCR",
        ["flaps.decrement"] = "FLAPS_DECR",
        ["trim.up"] = "ELEV_TRIM_UP",
        ["trim.down"] = "ELEV_TRIM_DN",
    };

    public static bool TryResolve(ControlCommand? input, out MappedCockpitEvent? result)
    {
        result = null;
        if (input is null || string.IsNullOrEmpty(input.Command)) return false;
        var value = input.Value;
        if (Switches.TryGetValue(input.Command, out var eventName))
        {
            if (value is not null) return false;
            result = new(eventName, 0);
            return true;
        }

        if (value is null || !double.IsFinite(value.Value) || value.Value != Math.Truncate(value.Value))
            return false;
        var n = value.Value;
        switch (input.Command)
        {
            case "brakes.parking.set":
                if (n is not (0 or 1)) return false;
                result = new("PARKING_BRAKE_SET", (uint)n);
                return true;
            case "radio.com1.set" or "radio.com2.set":
                if (n < 118_000_000 || n > 136_990_000 || n % 5_000 != 0) return false;
                result = new(input.Command == "radio.com1.set"
                    ? "COM_STBY_RADIO_SET_HZ" : "COM2_STBY_RADIO_SET_HZ", (uint)n);
                return true;
            case "radio.nav1.set" or "radio.nav2.set":
                if (n < 108_000_000 || n > 117_950_000 || n % 50_000 != 0) return false;
                result = new(input.Command == "radio.nav1.set"
                    ? "NAV1_STBY_SET_HZ" : "NAV2_STBY_SET_HZ", (uint)n);
                return true;
            case "transponder.code.set":
                if (n < 0 || n > 7777) return false;
                var digits = ((int)n).ToString("D4");
                if (digits.Any(c => c is < '0' or > '7')) return false;
                uint bcd = 0;
                foreach (var c in digits) bcd = (bcd << 4) | (uint)(c - '0');
                result = new("XPNDR_SET", bcd);
                return true;
            case "autopilot.heading.set":
                if (n < 0 || n > 359) return false;
                result = new("HEADING_BUG_SET", (uint)n);
                return true;
            case "autopilot.altitude.set":
                if (n < -1000 || n > 60000 || n % 100 != 0) return false;
                result = new("AP_ALT_VAR_SET_ENGLISH", unchecked((uint)(int)n));
                return true;
            case "autopilot.vs.set":
                if (n < -6000 || n > 6000 || n % 100 != 0) return false;
                result = new("AP_VS_VAR_SET_ENGLISH", unchecked((uint)(int)n));
                return true;
            default:
                return false;
        }
    }
}
