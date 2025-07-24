import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VirtualGlassesComponent } from "./components/virtual-glasses/virtual-glasses.component";
import { NavBarComponent } from "./components/nav-bar/nav-bar.component";
import { SideBarComponent } from "./components/side-bar/side-bar.component";

@Component({
  selector: 'app-root',
  imports: [NavBarComponent, RouterOutlet],
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'] // corrected styleUrl to styleUrls
})
export class AppComponent {
  title = 'virtual-glasses';
}
