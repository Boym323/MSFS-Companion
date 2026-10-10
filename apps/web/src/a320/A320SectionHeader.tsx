import './A320SectionHeader.css';

/** Consistent heading and provenance of Airbus web instruments.
 * Status text never implies the physical Airbus selector is verified.
 */
export default function A320SectionHeader({title,eyebrow,status}:{
 title:string;eyebrow:string;status:string
}){
 return <header className="a320-module-header">
  <div className="a320-module-header-copy">
   <span className="a320-module-eyebrow">{eyebrow}</span>
   <h3>{title}</h3>
  </div>
  <p role="status" className="a320-module-source">{status}</p>
 </header>;
}
