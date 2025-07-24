import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileGlassesOptimizerComponent } from './mobile-glasses-optimizer.component';

describe('MobileGlassesOptimizerComponent', () => {
  let component: MobileGlassesOptimizerComponent;
  let fixture: ComponentFixture<MobileGlassesOptimizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileGlassesOptimizerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MobileGlassesOptimizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
