export type Freshness={
  usable:boolean;requiresAcknowledgement:boolean;ageDays:number|null;reason:string;
};
/** Evidence age is NOT AIRAC validity or live activation. The source URL
 * currently identifies one fixed historical file, not a live feed. */
export function assessAirspaceSource(
  effectiveDate:string|null|undefined,cacheStale:boolean,nowMs:number,
):Freshness {
  const sourceDate=effectiveDate&&/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
    ?Date.parse(effectiveDate+'T00:00:00Z'):NaN;
  if(!Number.isFinite(sourceDate)||!Number.isFinite(nowMs)||
     sourceDate>nowMs+86400000)return {usable:false,requiresAcknowledgement:true,
       ageDays:null,reason:'Datum účinnosti zdroje je neznámé či v budoucnosti.'};
  const ageDays=Math.floor((nowMs-sourceDate)/86400000);
  // Conservative UX threshold only. NOT an assertion of legal AIRAC expiry.
  const old=ageDays>56;
  return {usable:true,ageDays,requiresAcknowledgement:old||cacheStale,
    reason:cacheStale?'Mezipaměť se nepodařilo čerstvě ověřit.'
      :old?'Publikovaný soubor je starší než 56 dnů a nemusí odpovídat aktuálnímu AIRAC/NOTAM.'
      :'Datum zdrojového souboru je relativně nedávné; aktivace a NOTAM nejsou ověřené.'};
}
