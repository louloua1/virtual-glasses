import { TestBed } from '@angular/core/testing';

import { VirtualGlassesService } from './virtual-glasses.service';

describe('VirtualGlassesService', () => {
  let service: VirtualGlassesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VirtualGlassesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
