import { InvalidInputError, SeriesPoint } from '../../domain/analysis';
import { ProcessGateway, ProcessInfo } from '../../application/ports';

/** Cliente HTTP do microsserviço pmining (MS1). */
export class PminingHttpGateway implements ProcessGateway {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 30000) {}

  async get(processId: string): Promise<ProcessInfo | null> {
    const res = await this.fetch(`/processes/${encodeURIComponent(processId)}`);
    if (res.status === 404) return null;
    const body = await this.json(res);
    return { id: body.id, name: body.name };
  }

  async series(processId: string, activity: string | null): Promise<SeriesPoint[]> {
    const query = activity ? `?activity=${encodeURIComponent(activity)}` : '';
    const res = await this.fetch(`/processes/${encodeURIComponent(processId)}/series${query}`);
    const body = await this.json(res);
    return body.points.map((p: any) => ({ index: p.index, caseId: p.caseId, value: p.value }));
  }

  private fetch(path: string) {
    return fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, { signal: AbortSignal.timeout(this.timeoutMs) });
  }

  private async json(res: Response): Promise<any> {
    const body: any = await res.json().catch(() => ({}));
    if (res.status === 422) throw new InvalidInputError(body.detail ?? 'O pmining recusou o pedido.');
    if (!res.ok) throw new Error(`pmining respondeu ${res.status}`);
    return body;
  }
}
