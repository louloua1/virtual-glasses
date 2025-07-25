import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImporterImageComponent } from './importer-image.component';

describe('ImporterImageComponent', () => {
  let component: ImporterImageComponent;
  let fixture: ComponentFixture<ImporterImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImporterImageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImporterImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
