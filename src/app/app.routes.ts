import { Routes } from '@angular/router';
import { GlassesComponent } from './components/glasses/glasses.component';
import { HomeComponent } from './components/home/home.component';
import { VirtualGlassesComponent } from './components/virtual-glasses/virtual-glasses.component';
import { EssayageComponent } from './components/essayage/essayage.component';

export const routes: Routes = [
    { path:'home', component: HomeComponent },
    {path:'' , redirectTo:'home',pathMatch:'full'},
    { path:'lunettes', component: GlassesComponent },
    { path:'essayage', component: EssayageComponent },
    { path:'virtual-glasses', component: VirtualGlassesComponent },
    
];
