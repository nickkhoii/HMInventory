"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Unable to load the laboratory</h1>
      <p>Check the database configuration and connection, then try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
