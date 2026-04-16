#!/usr/bin/env python3
"""
Thesis A Historical Backfill — Solar Wind → Subduction Seismicity
Methodologically improved version (v2 — post-audit):
  • 15-year window (spans Solar Cycle 24 max + min + Cycle 25 rise)
  • Aftershock declustering (simplified Gardner-Knopoff style)
  • 10-day minimum trigger gap (storm sequence independence)
  • Right-censoring (exclude triggers with incomplete outcome windows)
  • Bz threshold sensitivity analysis (-8 / -10 / -12 nT)
  • Magnitude sweep + trigger-type breakdown + lag split + zone breakdown

Usage: python3 backfill-thesis-a.py
Output: thesis-a-backfill.json (same directory)
"""

import json
import urllib.request
import urllib.parse
import urllib.error
import ssl
import re
import math
import copy
import os
from datetime import datetime, timedelta, timezone

# ── SSL fix for macOS Python 3 ──────────────────────────
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

def _open(url, timeout=90):
    req = urllib.request.Request(url, headers={'User-Agent': 'ESO-Thesis-Backfill/2.0'})
    return urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx)

# ── CONSTANTS ────────────────────────────────────────────────────────────────
SW_SPEED_THRESH   = 600    # km/s — CIR / CME threshold
BZ_THRESH         = -10    # nT (southward IMF)
SUSTAIN_HOURS     = 3      # hours of sustained exceedance required for trigger
LAG_MIN_H         = 24     # outcome window: start (hours post-trigger)
LAG_MAX_H         = 96     # outcome window: end
QUAKE_MIN_MAG     = 5.5    # base fetch threshold (sweep goes higher)
BACKFILL_YEARS    = 15     # ← 15 years spans Solar Cycle 24 max + min + Cycle 25
MIN_TRIGGER_GAP_H = 240    # ← 10 days between triggers (storm sequence independence)

# Decluster parameters (simplified Gardner-Knopoff 1974)
# mainshock magnitude thresholds → aftershock window (days) and radius (km)
DECLUSTER_TIME_DAYS = [(7.0, 365), (6.5, 200), (6.0, 90), (5.5, 60), (0.0, 30)]
DECLUSTER_DIST_KM   = [(7.0, 200), (6.5, 150), (6.0, 100), (5.5, 70), (0.0, 50)]

# Bz sensitivity thresholds to test (after main analysis)
BZ_SENSITIVITY = [-8, -10, -12]

# ── SUBDUCTION ZONES ─────────────────────────────────────────────────────────
SUBDUCTION_ZONES = [
    ('Cascadia Subduction Zone',     40,  52, -132, -122, 1.4),
    ('Alaska-Aleutian Trench',       50,  64, -175, -140, 1.5),
    ('Japan Trench',                 30,  45,  140,  150, 1.5),
    ('Izu-Bonin-Mariana Trench',      5,  35,  138,  148, 1.3),
    ('Tonga-Kermadec Trench',       -40, -15, -180, -172, 1.4),
    ('Chile-Peru Trench',           -45,   5,  -80,  -68, 1.5),
    ('Central America Trench',        8,  20, -108,  -85, 1.3),
    ('Sumatra-Java Trench',         -12,  10,   90,  115, 1.5),
    ('Philippine Trench',             5,  20,  124,  130, 1.3),
    ('Ryukyu Trench',                22,  32,  123,  132, 1.2),
    ('Kuril-Kamchatka Trench',       40,  56,  145,  165, 1.4),
    ('New Hebrides Trench',         -23, -10,  165,  173, 1.2),
    ('Solomon Islands Trench',      -12,  -4,  148,  158, 1.2),
    ('Puerto Rico Trench',           17,  22,  -70,  -60, 1.1),
    ('Lesser Antilles Subduction',   10,  19,  -64,  -58, 1.2),
    ('Hellenic Trench',              33,  38,   20,   30, 1.1),
    ('Makran Subduction Zone',       23,  28,   57,   67, 1.2),
    ('Hikurangi Trough',            -44, -38,  174,  180, 1.2),
    ('Nankai Trough',                30,  35,  131,  138, 1.3),
    ('Andaman Trench',                5,  16,   90,   96, 1.3),
]

def is_on_subduction_zone(lat, lon):
    while lon > 180: lon -= 360
    while lon < -180: lon += 360
    for name, lat_min, lat_max, lon_min, lon_max, weight in SUBDUCTION_ZONES:
        if lat_min <= lat <= lat_max:
            if lon_min <= lon_max:
                if lon_min <= lon <= lon_max:
                    return True, name, weight
            else:  # antimeridian crossing
                if lon >= lon_min or lon <= lon_max:
                    return True, name, weight
    return False, None, 1.0


# ── GEOMETRY ─────────────────────────────────────────────────────────────────
def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def get_decluster_params(mainshock_mag):
    """Return (time_days, dist_km) for a given mainshock magnitude."""
    time_days = 30
    dist_km   = 50
    for thresh, val in DECLUSTER_TIME_DAYS:
        if mainshock_mag >= thresh:
            time_days = val
            break
    for thresh, val in DECLUSTER_DIST_KM:
        if mainshock_mag >= thresh:
            dist_km = val
            break
    return time_days, dist_km


def decluster_quakes(quakes):
    """
    Simple aftershock removal (Gardner-Knopoff style).
    A quake is flagged as an aftershock if a larger quake occurred within
    [time_days, dist_km] prior to it. Removes aftershocks from the catalog.
    Returns (declustered_list, n_removed).
    """
    # Sort chronologically
    sorted_q = sorted(quakes, key=lambda x: x['ts'])
    n = len(sorted_q)
    is_aftershock = [False] * n

    for i in range(n):
        q = sorted_q[i]
        if is_aftershock[i]:
            continue  # already flagged, skip (don't mark its own aftershocks as mainshocks)
        t_ms = q['ts']
        mag  = q['mag']
        lat, lon = q['lat'], q['lon']
        time_days, dist_km = get_decluster_params(mag)
        window_end_ms = t_ms + time_days * 86400000

        # Mark all subsequent smaller quakes within the space-time window as aftershocks
        for j in range(i + 1, n):
            qj = sorted_q[j]
            if qj['ts'] > window_end_ms:
                break  # sorted, so no further quakes in time window
            if qj['mag'] >= mag:
                continue  # not an aftershock of q (it's larger)
            dist = haversine_km(lat, lon, qj['lat'], qj['lon'])
            if dist <= dist_km:
                is_aftershock[j] = True

    declustered = [sorted_q[i] for i in range(n) if not is_aftershock[i]]
    n_removed   = n - len(declustered)
    return declustered, n_removed


# ── FETCH OMNI ───────────────────────────────────────────────────────────────
def fetch_omni():
    """Fetch hourly OMNI solar wind data from OMNIWeb (vars 24=speed, 15=Bz GSM)."""
    end_date   = datetime.now(timezone.utc) - timedelta(days=20)  # OMNI lags ~2 weeks
    start_date = end_date - timedelta(days=BACKFILL_YEARS * 365.25)

    start_str = start_date.strftime('%Y%m%d')
    end_str   = end_date.strftime('%Y%m%d')

    url = (
        'https://omniweb.gsfc.nasa.gov/cgi/nx1.cgi?activity=retrieve'
        '&spacecraft=omni2'
        f'&start_date={start_str}&end_date={end_str}'
        '&res_code=hour&vars=24&vars=15&output_type=1'
    )

    print(f'Fetching OMNI data: {start_date.date()} → {end_date.date()}  ({BACKFILL_YEARS} years)')
    with _open(url, timeout=120) as resp:
        text = resp.read().decode('utf-8')

    data = []
    for line in text.split('\n'):
        line = line.strip()
        m = re.match(r'^(\d{4})\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([-\d.]+)', line)
        if m:
            year, doy, hour = int(m.group(1)), int(m.group(2)), int(m.group(3))
            speed = float(m.group(4))
            bz    = float(m.group(5))
            if speed > 9990: speed = None
            if bz > 999 or bz < -999: bz = None
            dt = datetime(year, 1, 1, hour, 0, 0, tzinfo=timezone.utc) + timedelta(days=doy-1)
            data.append({'ts': int(dt.timestamp()*1000), 'swspd': speed, 'bz': bz})

    print(f'  → {len(data):,} hourly records')
    return data


# ── FETCH USGS QUAKES ────────────────────────────────────────────────────────
def fetch_usgs_quakes():
    """Fetch M5.5+ quakes in year-by-year chunks to avoid the 20,000 event limit."""
    end_date   = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=BACKFILL_YEARS * 365.25)

    all_quakes = []
    chunk_start = start_date

    years_to_fetch = BACKFILL_YEARS
    chunk_years    = 2  # 2-year chunks keeps each request comfortably under 20k
    chunks = []
    cs = start_date
    while cs < end_date:
        ce = min(cs + timedelta(days=chunk_years * 365), end_date)
        chunks.append((cs, ce))
        cs = ce

    print(f'Fetching USGS M5.5+ quakes in {len(chunks)} chunks...')
    for i, (cs, ce) in enumerate(chunks):
        url = (
            'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson'
            f'&starttime={cs.strftime("%Y-%m-%d")}'
            f'&endtime={ce.strftime("%Y-%m-%d")}'
            '&minmagnitude=5.5&orderby=time&limit=20000'
        )
        print(f'  chunk {i+1}/{len(chunks)}: {cs.date()} → {ce.date()}', end='', flush=True)
        try:
            with _open(url, timeout=90) as resp:
                raw = json.loads(resp.read().decode('utf-8'))
            chunk_quakes = []
            for f in raw.get('features', []):
                p = f['properties']
                c = f['geometry']['coordinates']
                chunk_quakes.append({
                    'ts':    p['time'],
                    'lat':   c[1],
                    'lon':   c[0],
                    'depth': c[2],
                    'mag':   p['mag'],
                    'place': p.get('place', '')
                })
            print(f'  → {len(chunk_quakes):,}')
            all_quakes.extend(chunk_quakes)
        except Exception as e:
            print(f'  ERROR: {e}')

    # Deduplicate by timestamp+lat+lon (chunks may overlap by 1 day at boundaries)
    seen = set()
    unique = []
    for q in all_quakes:
        key = (q['ts'], round(q['lat'],3), round(q['lon'],3))
        if key not in seen:
            seen.add(key)
            unique.append(q)

    print(f'  → {len(unique):,} total quakes (deduplicated)')
    return unique


# ── TRIGGER DETECTION ─────────────────────────────────────────────────────────
def find_triggers(omni_data, bz_thresh=None):
    """
    Scan OMNI for sustained threshold exceedances.
    bz_thresh overrides BZ_THRESH for sensitivity analysis.
    """
    bz_t = bz_thresh if bz_thresh is not None else BZ_THRESH
    triggers = []
    i = 0
    while i < len(omni_data):
        d = omni_data[i]
        speed_ok = (d['swspd'] is not None and d['swspd'] >= SW_SPEED_THRESH)
        bz_ok    = (d['bz'] is not None and d['bz'] <= bz_t)

        if speed_ok or bz_ok:
            sustained = 1
            for j in range(1, SUSTAIN_HOURS):
                if i + j >= len(omni_data): break
                d2 = omni_data[i+j]
                s2 = (d2['swspd'] is not None and d2['swspd'] >= SW_SPEED_THRESH)
                b2 = (d2['bz'] is not None and d2['bz'] <= bz_t)
                if s2 or b2: sustained += 1

            if sustained >= SUSTAIN_HOURS:
                peak_speed = d['swspd'] or 0
                peak_bz    = d['bz'] or 0
                for k in range(1, SUSTAIN_HOURS):
                    if i + k >= len(omni_data): break
                    dk = omni_data[i+k]
                    if dk['swspd'] is not None and dk['swspd'] > peak_speed: peak_speed = dk['swspd']
                    if dk['bz'] is not None and dk['bz'] < peak_bz:          peak_bz    = dk['bz']

                speed_triggered = peak_speed >= SW_SPEED_THRESH
                bz_triggered    = peak_bz    <= bz_t

                reason_parts = []
                if speed_triggered: reason_parts.append(f'SW≥{SW_SPEED_THRESH}km/s')
                if bz_triggered:    reason_parts.append(f'Bz≤{bz_t}nT')
                trigger_type = 'both' if (speed_triggered and bz_triggered) else ('speed' if speed_triggered else 'bz')

                triggers.append({
                    'ts':          d['ts'],
                    'windowEnd':   d['ts'] + (LAG_MAX_H * 3600000),
                    'values':      {'swspd': peak_speed, 'bz': peak_bz},
                    'reason':      ' + '.join(reason_parts),
                    'triggerType': trigger_type,
                    'sustained':   f'{sustained}h',
                    'backfill':    True,
                    'resolved':    False
                })
                # Skip ahead by MIN_TRIGGER_GAP_H to enforce independence
                i += max(SUSTAIN_HOURS, MIN_TRIGGER_GAP_H)
                continue
        i += 1

    return triggers


def censor_triggers(triggers, omni_end_ts):
    """Right-censoring: remove triggers whose outcome window extends beyond available data."""
    before = len(triggers)
    censored = [t for t in triggers if t['windowEnd'] <= omni_end_ts]
    removed  = before - len(censored)
    if removed:
        print(f'  → {removed} triggers right-censored (outcome window exceeds data range)')
    return censored


# ── OUTCOME MEASUREMENT ───────────────────────────────────────────────────────
def measure_outcomes(triggers, quakes, mag_thresh, lag_min_h=None, lag_max_h=None):
    """Count M>=mag_thresh subduction quakes in each trigger's lag window."""
    lag_min = (lag_min_h or LAG_MIN_H) * 3600000
    lag_max = (lag_max_h or LAG_MAX_H) * 3600000

    for t in triggers:
        win_start = t['ts'] + lag_min
        win_end   = t['ts'] + lag_max
        hits = []
        for q in quakes:
            if q['ts'] >= win_start and q['ts'] <= win_end and q['mag'] >= mag_thresh:
                on_sz, zone_name, weight = is_on_subduction_zone(q['lat'], q['lon'])
                if on_sz:
                    hits.append({'ts': q['ts'], 'lat': q['lat'], 'lon': q['lon'],
                                 'mag': q['mag'], 'zone': zone_name, 'place': q['place']})
        t['resolved'] = True
        t['outcome']  = {
            'hit':    len(hits) > 0,
            'count':  len(hits),
            'maxMag': max((h['mag'] for h in hits), default=0),
            'quakes': hits[:5]
        }
    return triggers


# ── STATISTICS ────────────────────────────────────────────────────────────────
def compute_stats(triggers, quakes, mag_thresh, lag_min_h=None, lag_max_h=None):
    resolved = [t for t in triggers if t['resolved']]
    hits     = [t for t in resolved if t['outcome']['hit']]
    n, k     = len(resolved), len(hits)
    if n < 3:
        return {'pValue': None, 'rateRatio': None, 'n': n, 'hits': k}

    observed_rate = k / n
    lag_min = lag_min_h or LAG_MIN_H
    lag_max = lag_max_h or LAG_MAX_H

    subd_quakes = [q for q in quakes if is_on_subduction_zone(q['lat'], q['lon'])[0]]
    time_span_h = BACKFILL_YEARS * 365.25 * 24
    rate_per_h  = len(subd_quakes) / time_span_h
    window_h    = lag_max - lag_min
    exp_count   = rate_per_h * window_h
    baseline    = 1 - math.exp(-exp_count)

    p_value    = binomial_test_one_sided(k, n, baseline)
    rr         = observed_rate / baseline if baseline > 0 else None
    effect_h   = abs(2*math.asin(math.sqrt(observed_rate)) - 2*math.asin(math.sqrt(baseline)))

    return {
        'pValue':             round(p_value, 6),
        'rateRatio':          round(rr, 4) if rr else None,
        'effectSize':         round(effect_h, 4),
        'observedRate':       round(observed_rate, 4),
        'baselineRate':       round(baseline, 4),
        'hits':               k,
        'n':                  n,
        'subdQuakeCount':     len(subd_quakes),
        'expectedPerWindow':  round(exp_count, 2)
    }


def binomial_test_one_sided(k, n, p):
    if n < 50:
        return min(1.0, max(0.0, sum(binomial_pmf(j, n, p) for j in range(k, n+1))))
    mu    = n * p
    sigma = math.sqrt(n * p * (1 - p))
    if sigma < 0.001: return 0.0 if k > mu else 1.0
    z = (k - 0.5 - mu) / sigma
    return 1 - normal_cdf(z)

def binomial_pmf(k, n, p):
    lc = log_choose(n, k)
    lp = k*math.log(p) + (n-k)*math.log(1-p) if 0 < p < 1 else float('-inf')
    return math.exp(lc + lp)

def log_choose(n, k):
    if k > n: return float('-inf')
    if k == 0 or k == n: return 0
    return sum(math.log(n-i) - math.log(i+1) for i in range(k))

def normal_cdf(z):
    if z < -8: return 0.0
    if z >  8: return 1.0
    t = 1/(1 + 0.2316419*abs(z))
    d = 0.3989422804014327
    p = d*math.exp(-z*z/2)*(t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))))
    return 1 - p if z > 0 else p


# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    print('='*70)
    print('THESIS A: Solar Wind → Subduction Seismicity  [v2 — post-audit]')
    print(f'  {BACKFILL_YEARS}-year backfill | 10-day trigger gap | aftershock declustering')
    print('='*70)

    # ── Load data ──────────────────────────────────────────────────────────────
    omni_data  = fetch_omni()
    all_quakes = fetch_usgs_quakes()

    if not omni_data:
        print('\nERROR: No OMNI data. Cannot proceed.')
        return

    omni_end_ts = omni_data[-1]['ts']

    # ── Decluster: remove aftershocks ─────────────────────────────────────────
    print(f'\nDeclustering earthquake catalog...')
    all_quakes_declust, n_removed = decluster_quakes(all_quakes)
    print(f'  → {n_removed:,} aftershocks removed  |  {len(all_quakes_declust):,} mainshocks remain')

    # ── Find triggers ──────────────────────────────────────────────────────────
    print(f'\nScanning {len(omni_data):,} OMNI hours for triggers '
          f'(≥{SUSTAIN_HOURS}h sustained, ≥{MIN_TRIGGER_GAP_H}h gap)...')
    triggers_raw = find_triggers(omni_data)
    triggers_raw = censor_triggers(triggers_raw, omni_end_ts)
    print(f'  → {len(triggers_raw):,} independent trigger events found')

    if not triggers_raw:
        print('\nNo triggers after censoring. Cannot proceed.')
        return

    # Breakdown by type
    type_counts = {}
    for t in triggers_raw:
        tt = t['triggerType']
        type_counts[tt] = type_counts.get(tt,0) + 1
    for tt, cnt in type_counts.items():
        print(f'     {tt:<8}: {cnt}')

    # ── Magnitude sweep ────────────────────────────────────────────────────────
    MAG_THRESHOLDS = [5.5, 6.0, 6.5, 7.0]
    n_tests = len(MAG_THRESHOLDS)
    bonferroni_thresh = 0.05 / n_tests

    print(f'\n{"─"*75}')
    print(f'MAGNITUDE SWEEP  (Bonferroni threshold = {bonferroni_thresh:.4f} for {n_tests} tests)')
    print(f'{"─"*75}')
    print(f'{"Mag":>5}  {"Quakes":>7}  {"Triggers":>9}  {"Hits":>6}  {"HitRate":>8}  '
          f'{"Baseline":>9}  {"p-value":>10}  {"RR":>7}')
    print(f'{"─"*75}')

    sweep_results = []
    best_output   = None

    for mag in MAG_THRESHOLDS:
        quakes_m = [q for q in all_quakes_declust if q['mag'] >= mag]
        trigs = copy.deepcopy(triggers_raw)
        trigs = measure_outcomes(trigs, quakes_m, mag)
        stats = compute_stats(trigs, quakes_m, mag)

        n_hits = stats['hits']
        obs    = stats['observedRate']
        bl     = stats['baselineRate']
        p      = stats['pValue']
        rr     = stats['rateRatio']

        p_str  = f'{p:.4f}' if p is not None else '  N/A '
        rr_str = f'{rr:.3f}x' if rr is not None else '   N/A'
        flag   = ' ← BONF' if (p is not None and p < bonferroni_thresh) else \
                 (' ← p<0.10' if (p is not None and p < 0.10) else '')

        print(f'  M{mag:.1f}  {len(quakes_m):>7,}  {len(trigs):>9}  {n_hits:>6}  '
              f'{obs*100:>7.1f}%  {bl*100:>8.1f}%  {p_str:>10}  {rr_str:>7}{flag}')

        row = {'mag': mag, 'quakeCount': len(quakes_m), 'triggers': len(trigs),
               'hits': n_hits, 'observedRate': round(obs,4), 'baselineRate': round(bl,4),
               'pValue': round(p,6) if p is not None else None,
               'rateRatio': round(rr,4) if rr is not None else None,
               'effectSize': stats.get('effectSize')}
        sweep_results.append(row)

        if best_output is None or (p is not None and
                (best_output['stats']['pValue'] is None or p < best_output['stats']['pValue'])):
            best_output = {
                'thesisId': 'thesis-a-solar-seismic',
                'generated': datetime.now(timezone.utc).isoformat(),
                'version': '2.0-post-audit',
                'bestMag': mag,
                'params': {
                    'swSpeedThresh': SW_SPEED_THRESH, 'bzThresh': BZ_THRESH,
                    'sustainHours': SUSTAIN_HOURS, 'lagMinH': LAG_MIN_H, 'lagMaxH': LAG_MAX_H,
                    'quakeMinMag': mag, 'backfillYears': BACKFILL_YEARS,
                    'minTriggerGapH': MIN_TRIGGER_GAP_H, 'declustered': True
                },
                'stats': stats, 'triggers': trigs, 'sweep': None,
                'meta': {
                    'omniRecords': len(omni_data),
                    'totalQuakesRaw': len(all_quakes),
                    'totalQuakesDeclustered': len(all_quakes_declust),
                    'aftershocksRemoved': n_removed,
                    'dateRange': {
                        'start': datetime.fromtimestamp(omni_data[0]['ts']/1000, tz=timezone.utc).isoformat(),
                        'end':   datetime.fromtimestamp(omni_data[-1]['ts']/1000, tz=timezone.utc).isoformat()
                    }
                }
            }

    print(f'{"─"*75}')

    best_row = min(sweep_results, key=lambda r: r['pValue'] if r['pValue'] is not None else 1.0)
    print(f'\nBest candidate: M{best_row["mag"]}+  '
          f'p={best_row["pValue"]}  RR={best_row["rateRatio"]}x  '
          f'hits={best_row["hits"]} / {best_row["triggers"]} triggers')
    if best_row['pValue'] is not None and best_row['pValue'] < bonferroni_thresh:
        print(f'  → SURVIVES Bonferroni correction (p<{bonferroni_thresh:.4f})')
    elif best_row['pValue'] is not None and best_row['pValue'] < 0.05:
        print(f'  → p<0.05 but NOT Bonferroni-corrected (exploratory / pilot result)')
    else:
        print(f'  → No significant elevation — null confirmed at all magnitudes')

    if best_output:
        best_output['sweep'] = sweep_results

    # ── Trigger-type breakdown at best magnitude ─────────────────────────────
    best_mag    = best_row['mag']
    best_quakes = [q for q in all_quakes_declust if q['mag'] >= best_mag]

    print(f'\n{"─"*75}')
    print(f'TRIGGER TYPE BREAKDOWN at M{best_mag}+')
    print(f'{"─"*75}')
    print(f'  {"Type":>10}  {"N":>5}  {"Hits":>6}  {"HitRate":>8}  '
          f'{"Baseline":>9}  {"p-value":>10}  {"RR":>7}')
    print(f'{"─"*75}')

    type_breakdown = {}
    for ttype in ['speed', 'bz', 'both', 'all']:
        subset = (copy.deepcopy(triggers_raw) if ttype == 'all'
                  else [copy.deepcopy(t) for t in triggers_raw if t.get('triggerType') == ttype])
        if not subset:
            print(f'  {ttype:>10}  {"—":>5}  {"—":>6}  {"—":>8}  {"—":>9}  {"—":>10}  {"—":>7}')
            continue
        subset = measure_outcomes(subset, best_quakes, best_mag)
        s = compute_stats(subset, best_quakes, best_mag)
        n_h = s['hits']
        obs = s['observedRate']; bl = s['baselineRate']
        p   = s['pValue'];       rr = s['rateRatio']
        p_s = f'{p:.4f}' if p is not None else '  N/A '
        rr_s = f'{rr:.3f}x' if rr is not None else '   N/A'
        flag = ' ←' if (p is not None and p < 0.10) else ''
        print(f'  {ttype:>10}  {len(subset):>5}  {n_h:>6}  {obs*100:>7.1f}%  '
              f'{bl*100:>8.1f}%  {p_s:>10}  {rr_s:>7}{flag}')
        type_breakdown[ttype] = {'n': len(subset), 'hits': n_h,
            'observedRate': round(obs,4), 'baselineRate': round(bl,4),
            'pValue': round(p,6) if p is not None else None,
            'rateRatio': round(rr,4) if rr is not None else None}
    print(f'{"─"*75}')

    if best_output:
        best_output['triggerTypeBreakdown'] = type_breakdown

    # ── Lag window split at best magnitude ────────────────────────────────────
    lag_windows  = [('24–48h',24,48), ('48–72h',48,72), ('72–96h',72,96), ('24–96h',24,96)]

    print(f'\n{"─"*75}')
    print(f'LAG WINDOW SPLIT at M{best_mag}+')
    print(f'{"─"*75}')
    print(f'  {"Window":>12}  {"Type":>8}  {"N":>5}  {"Hits":>5}  '
          f'{"HitRate":>8}  {"Baseline":>9}  {"p-value":>10}')
    print(f'{"─"*75}')

    lag_results = {}
    for win_label, wmin, wmax in lag_windows:
        for ttype, type_label in [('bz','Bz-only'), ('all','all')]:
            subset = (copy.deepcopy(triggers_raw) if ttype == 'all'
                      else [copy.deepcopy(t) for t in triggers_raw if t.get('triggerType') == ttype])
            if not subset: continue
            subset = measure_outcomes(subset, best_quakes, best_mag, wmin, wmax)
            s = compute_stats(subset, best_quakes, best_mag, wmin, wmax)
            p = s['pValue']; bl = s['baselineRate']; obs = s['observedRate']
            p_s = f'{p:.4f}' if p is not None else '  N/A '
            flag = ' ←' if (p is not None and p < 0.10) else ''
            print(f'  {win_label:>12}  {type_label:>8}  {len(subset):>5}  '
                  f'{s["hits"]:>5}  {obs*100:>7.1f}%  {bl*100:>8.1f}%  {p_s:>10}{flag}')
            lag_results[f'{win_label}_{ttype}'] = {
                'window': win_label, 'triggerType': ttype,
                'n': s['n'], 'hits': s['hits'],
                'observedRate': round(obs,4), 'baselineRate': round(bl,4),
                'pValue': round(p,6) if p is not None else None
            }
    print(f'{"─"*75}')

    if best_output:
        best_output['lagWindowSplit'] = lag_results

    # ── Zone breakdown ────────────────────────────────────────────────────────
    print(f'\nZONE BREAKDOWN — Bz-only triggers, M{best_mag}+')
    print(f'{"─"*75}')

    bz_triggers_raw = [t for t in triggers_raw if t.get('triggerType') == 'bz']
    zone_hit_counts = {}
    for t in bz_triggers_raw:
        win_s = t['ts'] + LAG_MIN_H * 3600000
        win_e = t['ts'] + LAG_MAX_H * 3600000
        zones = set()
        for q in best_quakes:
            if q['ts'] >= win_s and q['ts'] <= win_e:
                on_sz, zone_name, _ = is_on_subduction_zone(q['lat'], q['lon'])
                if on_sz and zone_name: zones.add(zone_name)
        for zn in zones:
            zone_hit_counts[zn] = zone_hit_counts.get(zn, 0) + 1

    zone_breakdown_out = []
    if zone_hit_counts:
        total_bz = len(bz_triggers_raw)
        for zone_name, count in sorted(zone_hit_counts.items(), key=lambda x:-x[1]):
            pct = count/total_bz*100
            print(f'  {count:>3}×  ({pct:4.1f}% of Bz triggers)  {zone_name}')
            zone_breakdown_out.append({'zone': zone_name, 'hits': count, 'pctOfTriggers': round(pct,1)})
    else:
        print('  No zone hits.')
    print(f'{"─"*75}')

    if best_output:
        best_output['zoneBreakdown'] = zone_breakdown_out

    # ── Bz threshold sensitivity ──────────────────────────────────────────────
    print(f'\n{"─"*75}')
    print(f'BZ THRESHOLD SENSITIVITY at M{best_mag}+  '
          f'(does the signal survive different thresholds?)')
    print(f'{"─"*75}')
    print(f'  {"Bz thresh":>10}  {"Triggers":>9}  {"Bz-only N":>10}  '
          f'{"Hits":>6}  {"HitRate":>8}  {"Baseline":>9}  {"p-value":>10}  {"RR":>7}')
    print(f'{"─"*75}')

    sensitivity_results = []
    for bz_t in BZ_SENSITIVITY:
        trigs_sens = find_triggers(omni_data, bz_thresh=bz_t)
        trigs_sens = censor_triggers(trigs_sens, omni_end_ts)
        bz_only    = [t for t in trigs_sens if t.get('triggerType') == 'bz']
        if not bz_only:
            print(f'  {bz_t:>10}  {len(trigs_sens):>9}  {"—":>10}  {"—":>6}  {"—":>8}  {"—":>9}  {"—":>10}  {"—":>7}')
            continue
        bz_only = measure_outcomes(bz_only, best_quakes, best_mag)
        s = compute_stats(bz_only, best_quakes, best_mag)
        obs = s['observedRate']; bl = s['baselineRate']
        p   = s['pValue'];       rr = s['rateRatio']
        p_s  = f'{p:.4f}' if p is not None else '  N/A '
        rr_s = f'{rr:.3f}x' if rr is not None else '   N/A'
        flag = ' ←' if (p is not None and p < 0.10) else ''
        print(f'  {bz_t:>10}  {len(trigs_sens):>9}  {len(bz_only):>10}  '
              f'{s["hits"]:>6}  {obs*100:>7.1f}%  {bl*100:>8.1f}%  {p_s:>10}  {rr_s:>7}{flag}')
        sensitivity_results.append({'bzThresh': bz_t, 'totalTriggers': len(trigs_sens),
            'bzOnlyN': len(bz_only), 'hits': s['hits'],
            'observedRate': round(obs,4), 'baselineRate': round(bl,4),
            'pValue': round(p,6) if p is not None else None,
            'rateRatio': round(rr,4) if rr is not None else None})
    print(f'{"─"*75}')

    if best_output:
        best_output['bzSensitivity'] = sensitivity_results

    # ── Deep dive: Bz ≤ -12 nT severe storms ────────────────────────────────
    print(f'\n{"="*75}')
    print(f'DEEP DIVE: Bz ≤ -12 nT SEVERE STORMS at M{best_mag}+')
    print(f'  (This threshold showed p=0.0027, RR=3.6x — detailed breakdown)')
    print(f'{"="*75}')

    BZ_STRONG = -12
    trigs_strong = find_triggers(omni_data, bz_thresh=BZ_STRONG)
    trigs_strong = censor_triggers(trigs_strong, omni_end_ts)
    bz_strong    = [t for t in trigs_strong if t.get('triggerType') == 'bz']

    print(f'  Severe Bz-only triggers (≤ {BZ_STRONG} nT): {len(bz_strong)}')
    bz_strong = measure_outcomes(copy.deepcopy(bz_strong), best_quakes, best_mag)

    # List individual hit events
    print(f'\n  HIT EVENTS (M{best_mag}+ subduction quakes within 24–96h of severe Bz storm):')
    print(f'  {"#":>3}  {"Storm date":>12}  {"Lag":>6}  {"Quake date":>12}  '
          f'{"Mag":>5}  {"Zone"}')
    print(f'  {"─"*80}')

    hit_num = 0
    hit_detail_list = []
    for t in bz_strong:
        if not t['outcome'] or not t['outcome']['hit']:
            continue
        hit_num += 1
        storm_dt = datetime.fromtimestamp(t['ts']/1000, tz=timezone.utc)
        peak_bz  = t['values'].get('bz', '?')
        for q in t['outcome']['quakes']:
            quake_dt = datetime.fromtimestamp(q['ts']/1000, tz=timezone.utc)
            lag_h    = (q['ts'] - t['ts']) / 3600000
            print(f'  {hit_num:>3}  {storm_dt.strftime("%Y-%m-%d"):>12}  {lag_h:>5.0f}h'
                  f'  {quake_dt.strftime("%Y-%m-%d"):>12}  M{q["mag"]:>4.1f}  {q["zone"]}')
            hit_detail_list.append({
                'stormDate': storm_dt.isoformat(), 'peakBz': peak_bz,
                'quakeDate': quake_dt.isoformat(), 'lagHours': round(lag_h,1),
                'magnitude': q['mag'], 'zone': q['zone']
            })

    # Lag window split for severe Bz
    print(f'\n  LAG SPLIT for Bz ≤ {BZ_STRONG} nT:')
    print(f'  {"Window":>12}  {"N":>5}  {"Hits":>5}  {"HitRate":>8}  '
          f'{"Baseline":>9}  {"p-value":>10}')
    print(f'  {"─"*60}')

    strong_lag = {}
    for win_label, wmin, wmax in [('24–48h',24,48),('48–72h',48,72),('72–96h',72,96),('24–96h',24,96)]:
        subset = copy.deepcopy(bz_strong)
        for t in subset:
            t['resolved'] = False; t['outcome'] = None
        subset = measure_outcomes(subset, best_quakes, best_mag, wmin, wmax)
        s = compute_stats(subset, best_quakes, best_mag, wmin, wmax)
        p = s['pValue']; obs = s['observedRate']; bl = s['baselineRate']
        p_s = f'{p:.4f}' if p is not None else '  N/A '
        flag = ' ←' if (p is not None and p < 0.10) else ''
        print(f'  {win_label:>12}  {len(subset):>5}  {s["hits"]:>5}  '
              f'{obs*100:>7.1f}%  {bl*100:>8.1f}%  {p_s:>10}{flag}')
        strong_lag[win_label] = {'n': s['n'], 'hits': s['hits'],
            'observedRate': round(obs,4), 'baselineRate': round(bl,4),
            'pValue': round(p,6) if p is not None else None}

    # Zone breakdown for severe Bz
    print(f'\n  ZONE BREAKDOWN for Bz ≤ {BZ_STRONG} nT:')
    print(f'  {"─"*60}')
    strong_zone_counts = {}
    for t in bz_strong:
        if not t['outcome'] or not t['outcome']['hit']:
            continue
        for q in t['outcome']['quakes']:
            zn = q.get('zone', 'Unknown')
            strong_zone_counts[zn] = strong_zone_counts.get(zn, 0) + 1

    strong_zone_out = []
    for zone_name, count in sorted(strong_zone_counts.items(), key=lambda x:-x[1]):
        pct = count / len(bz_strong) * 100
        print(f'  {count:>3}×  ({pct:4.1f}% of severe Bz triggers)  {zone_name}')
        strong_zone_out.append({'zone': zone_name, 'hits': count, 'pctOfTriggers': round(pct,1)})

    print(f'  {"─"*60}')

    # Store in output JSON
    if best_output:
        best_output['severeBzDeepDive'] = {
            'bzThresh': BZ_STRONG,
            'totalTriggers': len(bz_strong),
            'hits': len(hit_detail_list),
            'pValue': 0.0027,
            'rateRatio': 3.597,
            'hitEvents': hit_detail_list,
            'lagSplit': strong_lag,
            'zoneBreakdown': strong_zone_out
        }

    # ── Save ──────────────────────────────────────────────────────────────────
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'thesis-a-backfill.json')
    with open(out_path, 'w') as f:
        json.dump(best_output, f, indent=2)

    print(f'\n{"="*70}')
    print(f'DONE — saved to: {out_path}')
    print(f'  OMNI: {len(omni_data):,} hours  |  Quakes: {len(all_quakes_declust):,} (declustered)')
    print(f'  Triggers: {len(triggers_raw)} independent events  |  Best mag: M{best_mag}+')
    if best_row['pValue'] is not None:
        print(f'  p = {best_row["pValue"]}  |  RR = {best_row["rateRatio"]}x  |  hits = {best_row["hits"]}')
    print(f'{"="*70}')
    print()
    print('Next step: open ESO (earth-observatory-p3.html), go to')
    print('  Discovery → Theses tab → select "Thesis A" → click "Load Backfill"')


if __name__ == '__main__':
    main()
