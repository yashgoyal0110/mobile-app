/**
 * Geo proxy routes — location search + routing. Mirrors Python `app/routes/geo.py`.
 *
 * Free provider (default): Nominatim for search/reverse, OSRM for routing.
 * All endpoints scoped to the configured region bbox to avoid abuse. Public
 * (no auth), matching the Python router.
 */
import {
  Controller,
  Get,
  HttpException,
  Logger,
  Query,
} from '@nestjs/common';
import axios from 'axios';
import {
  GEO_PROVIDER,
  NOMINATIM_URL,
  OSRM_URL,
  REGION_BBOX,
  USER_AGENT,
} from '../../config/constants';
import { haversineKm, round } from '../../common/utils';

const logger = new Logger('fifthdigit.geo');

function inBbox(lat: number, lng: number): boolean {
  return (
    REGION_BBOX.south <= lat &&
    lat <= REGION_BBOX.north &&
    REGION_BBOX.west <= lng &&
    lng <= REGION_BBOX.east
  );
}

@Controller('geo')
export class GeoController {
  @Get('region')
  getRegion() {
    return {
      bbox: REGION_BBOX,
      center: {
        lat: (REGION_BBOX.south + REGION_BBOX.north) / 2,
        lng: (REGION_BBOX.west + REGION_BBOX.east) / 2,
      },
      provider: GEO_PROVIDER,
    };
  }

  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('limit') limit = '8',
    @Query('bounded') bounded = '0',
  ) {
    if (GEO_PROVIDER === 'osm') {
      const viewbox = `${REGION_BBOX.west},${REGION_BBOX.north},${REGION_BBOX.east},${REGION_BBOX.south}`;
      const params = {
        q,
        format: 'json',
        limit: String(limit),
        viewbox,
        bounded: Number(bounded) ? '1' : '0',
        countrycodes: 'in',
        addressdetails: '1',
      };
      let data: any;
      try {
        const r = await axios.get(`${NOMINATIM_URL}/search`, {
          params,
          headers: { 'User-Agent': USER_AGENT },
          timeout: 10000,
        });
        data = r.data;
      } catch (e) {
        logger.warn(`Nominatim search failed: ${e}`);
        return { results: [] };
      }
      const results: any[] = [];
      for (const item of data) {
        let lat: number;
        let lng: number;
        try {
          lat = parseFloat(item.lat);
          lng = parseFloat(item.lon);
          if (isNaN(lat) || isNaN(lng)) continue;
        } catch {
          continue;
        }
        const addr = item.address || {};
        const short =
          addr.neighbourhood ||
          addr.suburb ||
          addr.village ||
          addr.town ||
          addr.hamlet ||
          addr.city ||
          (item.display_name || '').split(',')[0];
        results.push({
          name: short,
          address: item.display_name || '',
          lat,
          lng,
        });
      }
      return { results };
    }
    throw new HttpException(`Provider ${GEO_PROVIDER} not implemented`, 501);
  }

  @Get('reverse')
  async reverse(@Query('lat') latRaw: string, @Query('lng') lngRaw: string) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!inBbox(lat, lng)) {
      return {
        name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        address: 'Outside service area',
        lat,
        lng,
      };
    }
    if (GEO_PROVIDER === 'osm') {
      const params = { lat, lon: lng, format: 'json', zoom: 17 };
      let data: any;
      try {
        const r = await axios.get(`${NOMINATIM_URL}/reverse`, {
          params,
          headers: { 'User-Agent': USER_AGENT },
          timeout: 10000,
        });
        data = r.data;
      } catch (e) {
        logger.warn(`Nominatim reverse failed: ${e}`);
        return {
          name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          address: '',
          lat,
          lng,
        };
      }
      const addr = data.address || {};
      const name =
        addr.neighbourhood ||
        addr.suburb ||
        addr.village ||
        addr.town ||
        addr.hamlet ||
        (data.display_name || '').split(',')[0];
      return {
        name: name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        address: data.display_name || '',
        lat,
        lng,
      };
    }
    throw new HttpException(`Provider ${GEO_PROVIDER} not implemented`, 501);
  }

  @Get('route')
  async route(
    @Query('from_lat') fromLat: string,
    @Query('from_lng') fromLng: string,
    @Query('to_lat') toLat: string,
    @Query('to_lng') toLng: string,
  ) {
    const a = { lat: Number(fromLat), lng: Number(fromLng) };
    const b = { lat: Number(toLat), lng: Number(toLng) };
    if (GEO_PROVIDER === 'osm') {
      const url = `${OSRM_URL}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}`;
      let data: any;
      try {
        const r = await axios.get(url, {
          params: { overview: 'full', geometries: 'geojson' },
          headers: { 'User-Agent': USER_AGENT },
          timeout: 15000,
        });
        data = r.data;
      } catch (e) {
        logger.warn(`OSRM route failed: ${e}`);
        return haversineFallback(a.lat, a.lng, b.lat, b.lng);
      }
      if (data.code !== 'Ok' || !(data.routes && data.routes.length)) {
        return haversineFallback(a.lat, a.lng, b.lat, b.lng);
      }
      const rt = data.routes[0];
      const coords = rt.geometry.coordinates; // [[lng,lat], ...]
      return {
        distance_km: round(rt.distance / 1000, 2),
        duration_min: round(rt.duration / 60, 1),
        polyline: coords.map((c: number[]) => [c[1], c[0]]), // -> [lat,lng]
        source: 'osrm',
      };
    }
    throw new HttpException(`Provider ${GEO_PROVIDER} not implemented`, 501);
  }
}

function haversineFallback(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  let dist = haversineKm(aLat, aLng, bLat, bLng);
  // Apply a 1.3x road-factor for straight-line approximation
  dist *= 1.3;
  return {
    distance_km: round(dist, 2),
    duration_min: round((dist / 15) * 60, 1), // assume 15 km/h e-rickshaw
    polyline: [
      [aLat, aLng],
      [bLat, bLng],
    ],
    source: 'fallback',
  };
}
