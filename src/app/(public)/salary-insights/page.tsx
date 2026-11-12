import { BarChart, Card, EmptyState } from "@/components/ui";
import { getSalaryInsights } from "@/lib/queries/jobs";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Salary insights", description: "Average salary bands in India by job category and city, from live SetuJobs listings." };

function lpa(n: number) {
  return `₹${(n / 100000).toFixed(1)} LPA`;
}

export default async function SalaryInsightsPage() {
  const { byCategory, byCity } = await getSalaryInsights();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-fg">Salary insights</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Average advertised salary ranges computed from live job listings that disclose pay. Figures are per year in INR (1 LPA = ₹1,00,000).
      </p>

      {byCategory.length === 0 ? (
        <div className="mt-10"><EmptyState title="Not enough data yet" text="Insights appear once employers publish roles with disclosed salaries." /></div>
      ) : (
        <>
          <section className="mt-10 grid gap-8 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="font-bold text-fg">Average max salary by category (LPA)</h2>
              <div className="mt-6">
                <BarChart
                  data={byCategory.slice(0, 8).map((c) => ({ label: c.name, value: Math.round((c.avgMax ?? 0) / 100000) }))}
                  unit=""
                />
              </div>
            </Card>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <caption className="p-4 text-left font-bold text-fg">By category</caption>
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Typical range</th>
                    <th className="px-4 py-3 text-right">Listings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {byCategory.map((c) => (
                    <tr key={c.name}>
                      <td className="px-4 py-3 font-medium text-fg">{c.name}</td>
                      <td className="px-4 py-3 text-muted">{lpa(c.avgMin ?? 0)} – {lpa(c.avgMax ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-muted">{c.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <section className="mt-10">
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <caption className="p-4 text-left font-bold text-fg">By city</caption>
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Typical range</th>
                    <th className="px-4 py-3">Average max</th>
                    <th className="px-4 py-3 text-right">Listings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {byCity.map((c) => (
                    <tr key={c.city}>
                      <td className="px-4 py-3 font-medium text-fg">{c.city}</td>
                      <td className="px-4 py-3 text-muted">{lpa(c.avgMin ?? 0)} – {lpa(c.avgMax ?? 0)}</td>
                      <td className="px-4 py-3 text-muted">{formatINR(c.avgMax ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-muted">{c.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
