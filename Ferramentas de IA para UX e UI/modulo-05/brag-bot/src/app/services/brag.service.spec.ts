import { TestBed } from '@angular/core/testing';
import { BragService } from './brag.service';

describe('BragService', () => {
  let service: BragService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BragService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial brags and loading false', () => {
    expect(service.brags().length).toBeGreaterThan(0);
    expect(service.loading()).toBe(false);
  });

  it('should generate mock brag, toggle loading, and add to brags signal', async () => {
    const initialCount = service.brags().length;
    const prompt = 'Desenvolvi um agente autônomo com Genkit';

    const promise = service.generateMockBrag(prompt);
    expect(service.loading()).toBe(true);

    const generated = await promise;
    expect(service.loading()).toBe(false);
    expect(generated.id).toBeDefined();
    expect(generated.technologies.length).toBeGreaterThan(0);
    expect(service.brags().length).toBe(initialCount + 1);
    expect(service.brags()[0].id).toBe(generated.id);
  });

  it('should retrieve brag by id', () => {
    const firstBrag = service.brags()[0];
    const retrieved = service.getBragById(firstBrag.id);
    expect(retrieved).toEqual(firstBrag);
  });
});
