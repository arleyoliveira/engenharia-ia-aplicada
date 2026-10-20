import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CfpDashboardComponent } from './cfp-dashboard.component';
import { SpeakerDTO } from '@cfp-platform/shared-types';

describe('CfpDashboardComponent', () => {
  let component: CfpDashboardComponent;
  let fixture: ComponentFixture<CfpDashboardComponent>;
  let httpMock: HttpTestingController;

  const mockSpeakers: SpeakerDTO[] = [
    {
      id: '1',
      nome: 'Ada Lovelace',
      email: 'ada@example.com',
      talkTitle: 'First Algorithm',
      isGDE: true,
    },
    {
      id: '2',
      nome: 'Alan Turing',
      email: 'alan@example.com',
      talkTitle: 'Turing Machines',
      isGDE: false,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CfpDashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CfpDashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and start in loading state', () => {
    expect(component).toBeTruthy();
    expect(component.isLoading()).toBe(true);
    expect(component.speakers()).toEqual([]);
    expect(component.errorMessage()).toBeNull();

    fixture.detectChanges(); // triggers ngOnInit

    // Satisfy initial ngOnInit request
    const req = httpMock.expectOne('/api/speakers');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should populate speakers Signal and render table on successful fetch', () => {
    fixture.detectChanges(); // triggers ngOnInit

    const req = httpMock.expectOne('/api/speakers');
    expect(req.request.method).toBe('GET');
    req.flush(mockSpeakers);

    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.speakers().length).toBe(2);

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    // Verify first row data
    expect(rows[0].querySelector('.cell-speaker')?.textContent).toContain('Ada Lovelace');
    expect(rows[0].querySelector('.cell-email')?.textContent).toContain('ada@example.com');
    expect(rows[0].querySelector('.cell-title')?.textContent).toContain('First Algorithm');
    expect(rows[0].querySelector('.badge-gde')).toBeTruthy();

    // Verify second row is not GDE
    expect(rows[1].querySelector('.cell-speaker')?.textContent).toContain('Alan Turing');
    expect(rows[1].querySelector('.badge-standard')).toBeTruthy();
  });

  it('should render empty state when no speakers are returned', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/speakers');
    req.flush([]);

    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.speakers().length).toBe(0);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
    expect(compiled.querySelector('.cfp-table')).toBeNull();
  });

  it('should handle HTTP error and set errorMessage Signal', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/speakers');
    req.flush({ message: 'Falha de comunicação com o servidor' }, { status: 500, statusText: 'Internal Server Error' });

    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.speakers()).toEqual([]);
    expect(component.errorMessage()).toBe('Falha de comunicação com o servidor');

    const compiled = fixture.nativeElement as HTMLElement;
    const alert = compiled.querySelector('.alert-danger');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toContain('Falha de comunicação com o servidor');
  });

  it('should render navigation link back to submission form', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/speakers');
    req.flush([]);

    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[routerLink="/"]');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Nova Proposta');
  });
});
