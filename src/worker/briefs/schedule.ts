import type { Settings } from '../../shared/contracts';
function parts(zone: string, now: Date) { return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{ timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(now).map(p=>[p.type,p.value])); }
export function localDate(zone: string, now: Date) { const p=parts(zone,now); return `${p.year}-${p.month}-${p.day}`; }
export function scheduledEdition(settings: Settings, now: Date) {
  const p=parts(settings.timeZone,now); const [h,m]=settings.deliveryTime.split(':').map(Number); const current=Number(p.hour)*60+Number(p.minute); const delivery=h*60+m;
  const distance=(current-(delivery-settings.collectionLeadMinutes)+1440)%1440;
  if(distance>settings.collectionLeadMinutes+120) return null;
  const nextDay=current>delivery+120;
  const day=localDate(settings.timeZone,nextDay?new Date(now.getTime()+12*3600000):now);
  return { editionId:`owner:${day}`,localDate:day };
}
