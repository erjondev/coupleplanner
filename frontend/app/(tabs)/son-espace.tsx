import SpaceScreen from '../../components/SpaceScreen';

/** "Son Espace" : les tâches communes assignées au partenaire. */
export default function SonEspace() {
  return <SpaceScreen space="partner" emptyLabel="Aucune tâche assignée à votre partenaire." />;
}
