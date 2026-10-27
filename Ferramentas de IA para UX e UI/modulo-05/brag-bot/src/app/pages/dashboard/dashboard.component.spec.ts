import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard.component';
import { BragService } from '../../services/brag.service';
import { BragItem } from '../../models/brag.model';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let bragService: BragService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        BragService,
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    bragService = TestBed.inject(BragService);
    fixture.detectChanges();
  });

  it('should create dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should render header with Brag-Bot | Pós IA UNIPDS', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const headerTitle = compiled.querySelector('h1')?.textContent;
    expect(headerTitle).toContain('Brag-Bot');
    expect(headerTitle).toContain('Pós IA UNIPDS');
  });

  it('should have a textarea and destilar button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const textarea = compiled.querySelector('textarea#rawPrompt');
    const button = compiled.querySelector('button[type="submit"]');
    expect(textarea).toBeTruthy();
    expect(button?.textContent).toContain('Destilar Conquista');
  });

  it('should render cards for existing brags with @for loop', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('article');
    expect(cards.length).toBe(bragService.brags().length);
  });

  it('should add a new brag and display it in the list after submission', async () => {
    const initialCount = bragService.brags().length;
    const testPrompt = 'Nova conquista de teste com Genkit';
    component.setPrompt(testPrompt);
    fixture.detectChanges();

    const mockCreatedBrag: BragItem = {
      id: 'test-123',
      title: 'Nova conquista de teste com Genkit',
      context: 'Contexto de teste',
      impact: 'Impacto de teste',
      metrics: '100% de sucesso',
      technologies: ['Genkit', 'Angular'],
      createdAt: new Date(),
      rawPrompt: testPrompt,
    };

    vi.spyOn(bragService, 'generateBrag').mockImplementation(async () => {
      bragService.brags.update((items) => [mockCreatedBrag, ...items]);
      return mockCreatedBrag;
    });

    await component.onSubmit();
    fixture.detectChanges();

    expect(bragService.brags().length).toBe(initialCount + 1);
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('article');
    expect(cards.length).toBe(initialCount + 1);
    expect(cards[0].textContent).toContain('Nova conquista de teste com Genkit');
  });
});

