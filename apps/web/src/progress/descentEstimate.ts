/** Read-only arithmetic relative to the currently active GPS waypoint,
 * not a flight-management VNAV profile or final airport ETA. */
export function estimateDescentToWaypoint(input:{
  currentAltitudeFeet:number; targetAltitudeFeet:number;
  descentFpm:number; distanceNm:number; eteSeconds:number;
}):{minutes:number; requiredDistanceNm:number; remainingBeforeTodNm:number;
  groundSpeedKnots:number; status:'ahead'|'at-or-past'}|null{
  const {currentAltitudeFeet,targetAltitudeFeet,descentFpm,distanceNm,eteSeconds}=input;
  if(!Object.values(input).every(Number.isFinite)
    ||currentAltitudeFeet<-1000||currentAltitudeFeet>60000
    ||targetAltitudeFeet<0||targetAltitudeFeet>45000
    ||currentAltitudeFeet<=targetAltitudeFeet
    ||descentFpm<300||descentFpm>3000
    ||distanceNm<=0||distanceNm>5000
    ||eteSeconds<30||eteSeconds>6*3600)return null;
  const gs=distanceNm*3600/eteSeconds;
  if(gs<35||gs>550)return null;
  const minutes=(currentAltitudeFeet-targetAltitudeFeet)/descentFpm;
  if(minutes>120)return null;
  const requiredDistanceNm=minutes*gs/60;
  if(!Number.isFinite(requiredDistanceNm)||requiredDistanceNm>3000)return null;
  const gap=distanceNm-requiredDistanceNm;
  return {minutes:Math.round(minutes*10)/10,
    requiredDistanceNm:Math.round(requiredDistanceNm*10)/10,
    remainingBeforeTodNm:Math.round(Math.max(0,gap)*10)/10,
    groundSpeedKnots:Math.round(gs),
    status:gap>0?'ahead':'at-or-past'};
}
