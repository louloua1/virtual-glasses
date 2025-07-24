import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EssayageComponent } from './essayage.component';

describe('EssayageComponent', () => {
  let component: EssayageComponent;
  let fixture: ComponentFixture<EssayageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EssayageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EssayageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
