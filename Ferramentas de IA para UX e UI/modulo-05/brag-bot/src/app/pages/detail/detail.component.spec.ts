import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DetailComponent } from './detail.component';
import { BragService } from '../../services/brag.service';

describe('DetailComponent', () => {
  let component: DetailComponent;
  let fixture: ComponentFixture<DetailComponent>;
  let bragService: BragService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        BragService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'brag-1' : null)
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DetailComponent);
    component = fixture.componentInstance;
    bragService = TestBed.inject(BragService);
    fixture.detectChanges();
  });

  it('should create detail component', () => {
    expect(component).toBeTruthy();
  });

  it('should render brag details for brag-1', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const brag = bragService.getBragById('brag-1')!;
    expect(compiled.textContent).toContain(brag.title);
    expect(compiled.textContent).toContain('Contexto Técnico');
    expect(compiled.textContent).toContain('Impacto no Negócio');
    expect(compiled.textContent).toContain(brag.metrics);
  });

  it('should have a return button to dashboard', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const backBtn = compiled.querySelector('a[routerLink="/"]');
    expect(backBtn?.textContent).toContain('Voltar ao Dashboard');
  });
});
