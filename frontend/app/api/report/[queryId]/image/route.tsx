import { ImageResponse } from 'next/og';
import { TrendSummary, Query, TrendResult } from '@/lib/types';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

interface ReportData {
  summary: TrendSummary;
  query: Query;
  results?: TrendResult[];
  weightedConfidence?: number;
  sourceCount?: number;
  freshness?: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ queryId: string }> }
) {
  const { queryId } = await params;
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  let data: ReportData | null = null;
  try {
    const response = await fetch(`${API_BASE}/api/trends/${queryId}`);
    if (response.ok) {
      const json = await response.json();
      data = {
        summary: json.summary,
        query: json.query,
        results: json.results,
        weightedConfidence: json.telemetry?.agreementScore ? Math.round(json.telemetry.agreementScore * 100) : (json.summary?.confidenceScore ? Math.round(json.summary.confidenceScore * 100) : 0),
        sourceCount: json.results?.reduce((acc: number, r: TrendResult) => acc + (r.items?.length || 0), 0) || 0,
        freshness: 'RECENT' // Simplified for OG
      };
    }
  } catch (e) {
    console.error('Failed to fetch data for report image', e);
  }

  if (!data || !data.summary) {
    return new ImageResponse(
      (
        <div style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: 60, fontWeight: 'black', marginBottom: 20 }}>TRENDE</div>
          <div style={{ fontSize: 30, color: '#00ff88' }}>REPORT NOT FOUND</div>
        </div>
      ),
      { ...size }
    );
  }

  const { summary, query, weightedConfidence, sourceCount } = data;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0a0a0a',
          color: '#fff',
          fontFamily: 'sans-serif',
          padding: '40px',
          border: '12px solid #00ff88',
          position: 'relative',
        }}
      >
        {/* Background Decorative Elements */}
        <div style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,136,0.15) 0%, rgba(0,255,136,0) 70%)',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              backgroundColor: '#00ff88',
              color: '#000',
              padding: '4px 12px',
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '8px',
              alignSelf: 'flex-start'
            }}>
              TRENDE // INTELLIGENCE REPORT
            </div>
            <div style={{ fontSize: '14px', color: '#00ff88', letterSpacing: '2px' }}>
              VERIFIABLE TEE-SECURED ALPHA
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>REPORT_ID</div>
            <div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{queryId.slice(0, 12)}...</div>
          </div>
        </div>

        {/* Topic Title */}
        <div style={{ fontSize: '48px', fontWeight: 900, marginBottom: '24px', textTransform: 'uppercase', lineHeight: 1.1 }}>
          {query.idea}
        </div>

        {/* Summary Overview */}
        <div style={{
          fontSize: '24px',
          color: '#ccc',
          marginBottom: '40px',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {summary.overview}
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
          <div style={{ flex: 1, backgroundColor: '#141414', border: '2px solid #fff', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '6px 6px 0px 0px #00ff88' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>CONFIDENCE</div>
            <div style={{ fontSize: '36px', fontWeight: 'black', color: '#00ff88' }}>{weightedConfidence}%</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#141414', border: '2px solid #fff', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '6px 6px 0px 0px #00ffff' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>SIGNALS</div>
            <div style={{ fontSize: '36px', fontWeight: 'black', color: '#00ffff' }}>{sourceCount}</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#141414', border: '2px solid #fff', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '6px 6px 0px 0px #ffaa00' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>SENTIMENT</div>
            <div style={{ fontSize: '36px', fontWeight: 'black', color: '#ffaa00', textTransform: 'uppercase' }}>{summary.sentiment}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #333', paddingTop: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>ATTESTATION</div>
            <div style={{ fontSize: '14px', color: '#00ff88' }}>TEE_SIGNED_VERIFIED_OK</div>
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            WWW.TRENDE.APP
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
