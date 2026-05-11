export default function BookDetailPage({ params }: { params: { id: string } }) {
  return (
    <main>
      <h1>Book Detail</h1>
      <p>Dettaglio libro ID: {params.id} — pagina placeholder (Fase 1)</p>
    </main>
  );
}
