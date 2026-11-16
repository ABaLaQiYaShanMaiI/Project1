import { utmOf, utmToLonLat } from '../app/src/core/geo.ts';
const cases = [[50.62, 9.72], [0, 9.72], [-33.9, 18.4], [60.17, 24.94], [-8.05, -34.9]];
for (const [lat, lon] of cases) {
  const u = utmOf(lat, lon);
  const south = lat < 0;
  const [lo2, la2] = utmToLonLat(u.zone, u.easting, u.northing, south);
  console.log(lat.toFixed(4), lon.toFixed(4), '->', la2.toFixed(6), lo2.toFixed(6), 'err_m', ((la2-lat)*111320).toFixed(2), (((lo2-lon)*111320*Math.cos(lat*Math.PI/180))).toFixed(2));
}
const u = utmOf(50.62, 9.72);
console.log('fulda utm', u);
const c = utmToLonLat(u.zone, Math.floor(u.easting/1000)*1000, Math.floor(u.northing/1000)*1000, false);
console.log('cell sw', c);

