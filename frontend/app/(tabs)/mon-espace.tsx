import SpaceScreen from '../../components/SpaceScreen';

/** "Mon Espace" : mes tâches privées, invisibles pour le partenaire. */
export default function MonEspace() {
  return <SpaceScreen space="mine" emptyLabel="Aucune tâche privée. Dictez-en une avec le micro !" />;
}
