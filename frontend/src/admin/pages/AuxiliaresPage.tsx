import { AuxiliaresPanel } from '../components/AuxiliaresPanel';
import { useAcademico } from '../components/AcademicoUI';

export default function AuxiliaresPage() {
  const catalogo = useAcademico();
  return <AuxiliaresPanel catalogo={catalogo} />;
}
