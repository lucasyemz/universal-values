export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16 sm:py-24">
      <header className="mb-16 flex items-center justify-between gap-4">
        <span className="text-lg font-bold tracking-tight">Universal Values</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">Em desenvolvimento</span>
      </header>
      <section aria-labelledby="welcome-heading" className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-teal-700">Um lugar para cada informação</p>
        <h1 id="welcome-heading" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Mantenha os valores do seu site em sintonia.</h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">Encontre preços, telefones e datas repetidos. Escolha quais representam a mesma informação e acompanhe suas alterações em um só lugar.</p>
      </section>
      <section aria-labelledby="start-heading" className="mt-12 rounded-2xl border border-slate-200 bg-white p-8">
        <h2 id="start-heading" className="text-xl font-semibold">Seu primeiro site</h2>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">Nenhum site conectado. A conexão com Webflow estará disponível na próxima etapa.</p>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          <li><h3 className="font-semibold">1. Conecte seu site</h3><p className="mt-2 text-sm leading-6 text-slate-600">Autorize a leitura do conteúdo no Webflow.</p></li>
          <li><h3 className="font-semibold">2. Revise os valores</h3><p className="mt-2 text-sm leading-6 text-slate-600">Selecione as ocorrências que deseja gerenciar juntas.</p></li>
          <li><h3 className="font-semibold">3. Confirme alterações</h3><p className="mt-2 text-sm leading-6 text-slate-600">Confira a prévia antes de autorizar uma atualização.</p></li>
        </ol>
      </section>
    </main>
  );
}
