import { useEffect, useState } from 'react';

export default function Home() {
  const [Comp, setComp] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    import('../client/AppWrapper')
      .then((m) => setComp(() => m.default))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div>Error: {err}</div>;
  if (!Comp) return <div>Loading...</div>;
  return <Comp />;
}
