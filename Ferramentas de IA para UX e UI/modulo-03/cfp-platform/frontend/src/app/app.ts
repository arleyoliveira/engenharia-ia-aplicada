import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CfpFormComponent } from './components/cfp-form/cfp-form.component';

@Component({
  imports: [RouterModule, CfpFormComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'frontend';
}
