const checkpoints = [
  ['Blueprint', 'Approved', 'sha256:7fd0…4a21'],
  ['Generation run', 'Bounded', '24 / 40 steps'],
  ['Connector', 'Authorized', 'supplier.read_profile'],
  ['Staging release', 'Healthy', 'artifact sha256:c814…91de'],
] as const;

export default function HomePage() {
  return (
    <main>
      <header>
        <p className="eyebrow">Northstar Procurement / Supplier onboarding</p>
        <h1>Turn a reviewed workflow into governed software.</h1>
        <p className="lede">
          HelixWorks binds code, data authority, release evidence, and recovery to the same
          immutable workflow version.
        </p>
      </header>

      <section aria-labelledby="release-heading">
        <div>
          <p className="eyebrow">Release candidate</p>
          <h2 id="release-heading">Supplier Portal v1</h2>
        </div>
        <span className="status">Ready for canary</span>
      </section>

      <ol aria-label="Release evidence">
        {checkpoints.map(([label, state, evidence]) => (
          <li key={label}>
            <span>{label}</span>
            <strong>{state}</strong>
            <code>{evidence}</code>
          </li>
        ))}
      </ol>

      <aside>
        <p className="eyebrow">Why promotion is allowed</p>
        <p>
          Tenant isolation, exact connector arguments, artifact provenance, and rollback probes
          passed for this digest. Promotion never rebuilds the artifact.
        </p>
      </aside>
    </main>
  );
}
