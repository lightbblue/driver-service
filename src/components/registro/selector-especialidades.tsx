import { ActivityIndicator, Text, View } from 'react-native';

import { Chip } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { COLORES } from '@/lib/tema';
import { listarEspecialidades } from '@/services';

type SelectorEspecialidadesProps = {
  valor: string[];
  onCambio: (especialidades: string[]) => void;
  etiqueta?: string;
};

/**
 * Especialidades como tags de una lista fija (tabla `especialidades`).
 * Son las mismas que usa el filtro del mapa.
 */
export function SelectorEspecialidades({ valor, onCambio, etiqueta = 'Especialidades' }: SelectorEspecialidadesProps) {
  const catalogo = useRecurso<string[]>(listarEspecialidades, []);

  const alternar = (nombre: string) =>
    onCambio(valor.includes(nombre) ? valor.filter((e) => e !== nombre) : [...valor, nombre]);

  return (
    <View testID="selector-especialidades" className="gap-2">
      <Text className="text-sm font-semibold text-texto">{etiqueta}</Text>
      {catalogo.cargando ? (
        <ActivityIndicator color={COLORES.acento} />
      ) : catalogo.error ? (
        <Text className="text-mini text-peligro">{catalogo.error}</Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {catalogo.datos.map((nombre) => (
            <Chip key={nombre} texto={nombre} activo={valor.includes(nombre)} onPress={() => alternar(nombre)} />
          ))}
        </View>
      )}
      <Text className="text-mini text-texto-tenue">
        {valor.length === 0 ? 'Tocá las que hacés.' : `${valor.length} elegida${valor.length === 1 ? '' : 's'}.`}
      </Text>
    </View>
  );
}
