using MsfsCompanion.Bridge.Aircraft;
namespace MsfsCompanion.Bridge.Controls;

/// <summary>No unverified generic autopilot writes on any Airbus variant.</summary>
public static class AirbusCommandPolicy
{
    public static bool MaySend(string? aircraftTitle,string? command) =>
        !AircraftProfileResolver.IsAirbusLike(aircraftTitle) ||
        !(command?.StartsWith("autopilot.",StringComparison.Ordinal)??false);

    public static bool CanUseGenericAutopilot(string? title) =>
        !AircraftProfileResolver.IsAirbusLike(title);
}
