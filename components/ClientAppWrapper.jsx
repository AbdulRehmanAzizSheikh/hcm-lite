'use client';

import dynamic from 'next/dynamic';

const ClientApp = dynamic(() => import('../client/App'), { ssr: false, loading: () => <p>Loading app...</p> });

export default function ClientAppWrapper() {
  return <ClientApp />;
}
