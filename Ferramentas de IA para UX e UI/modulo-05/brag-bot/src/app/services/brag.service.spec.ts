import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BragService } from './brag.service';

describe('BragService', () => {
  let service: BragService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        BragService,
      ],
    });
    service = TestBed.inject(BragService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial brags and loading false', () => {
    expect(service.brags().length).toBeGreaterThan(0);
    expect(service.loading()).toBe(false);
  });

  it('should generate brag, toggle loading, and add to brags signal', async () => {
    const initialCount = service.brags().length;
    const prompt = 'Desenvolvi um agente autônomo com Genkit';
    const mockApiResponse = {
      id: 'flow-test-id-123',
      title: 'Agente Autônomo com Genkit',
      context: 'Processo manual demandava alto tempo.',
      actionTaken: 'Desenvolvi um agente autônomo.',
      businessImpact: 'Redução de 90% no tempo.',
      metrics: ['90% de ganho de eficiência'],
      technologiesUsed: ['Genkit', 'TypeScript', 'Google AI'],
    };

    const promise = service.generateBrag(prompt);
    expect(service.loading()).toBe(true);

    const req = httpMock.expectOne('/api/brag');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ definition: prompt });
    req.flush(mockApiResponse);

    const generated = await promise;
    expect(service.loading()).toBe(false);
    expect(generated.id).toBe(mockApiResponse.id);
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

