import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { BragService } from '../../services/brag.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let bragService: BragService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), BragService]
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
    component.setPrompt('Nova conquista de teste com Genkit');
    fixture.detectChanges();

    await component.onSubmit();
    fixture.detectChanges();

    expect(bragService.brags().length).toBe(initialCount + 1);
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('article');
    expect(cards.length).toBe(initialCount + 1);
    expect(cards[0].textContent).toContain('Nova conquista de teste com Genkit');
  });
});
