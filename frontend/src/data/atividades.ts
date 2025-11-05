export type StatusAtividade = 'Pendente' | 'Concluído' | 'Não Concluído'
export type NivelAtividade = 'Baixo' | 'Normal' | 'Alto' | 'Máximo'

export type Atividade = {
  id: number
  nome: string
  registro: string
  nivel: NivelAtividade
  status: StatusAtividade
  lat: number
  lng: number
}

const BASE_CENTER = { lat: -3.77, lng: -38.48 }

function randomOffset() {
  // ~±110m (0.001 deg ≈ 111m). Keep points within campus vicinity.
  return (Math.random() - 0.5) * 0.002
}

function withCoords<T extends Omit<Atividade, 'lat' | 'lng'>>(item: T): Atividade {
  return {
    ...item,
    lat: BASE_CENTER.lat + randomOffset(),
    lng: BASE_CENTER.lng + randomOffset(),
  }
}

export const atividadesPorDia: Record<string, Atividade[]> = {
  Hoje: [
    withCoords({
      id: 1,
      nome: 'Maria Silva',
      registro: 'Fiscalizando banheiro do segundo andar do bloco M',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 2,
      nome: 'João Santos',
      registro: 'No laboratório do bloco D',
      nivel: 'Máximo',
      status: 'Pendente',
    }),
    withCoords({
      id: 3,
      nome: 'Ana Costa',
      registro: 'Limpeza da biblioteca central',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 4,
      nome: 'Carlos Oliveira',
      registro: 'Fiscalizando corredores do bloco A',
      nivel: 'Alto',
      status: 'Não Concluído',
    }),
    withCoords({
      id: 5,
      nome: 'Fernanda Lima',
      registro: 'Na sala de convivência do bloco C',
      nivel: 'Normal',
      status: 'Pendente',
    }),
    withCoords({
      id: 6,
      nome: 'Roberto Alves',
      registro: 'Fiscalizando salas de aula do bloco E',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 70,
      nome: 'Paula Souza',
      registro: 'Organização de documentos na secretaria',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 71,
      nome: 'Ricardo Costa',
      registro: 'Monitoramento de segurança no estacionamento',
      nivel: 'Alto',
      status: 'Pendente',
    }),
  ],
  Ontem: [
    withCoords({
      id: 7,
      nome: 'Patricia Mendes',
      registro: 'Fiscalizando banheiro do primeiro andar do bloco B',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 8,
      nome: 'Lucas Ferreira',
      registro: 'No laboratório de química do bloco F',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 9,
      nome: 'Sandra Rodrigues',
      registro: 'Limpeza do auditório principal',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 10,
      nome: 'Marcos Pereira',
      registro: 'Fiscalizando corredores do bloco G',
      nivel: 'Alto',
      status: 'Não Concluído',
    }),
    withCoords({
      id: 11,
      nome: 'Carla Santos',
      registro: 'No hall do bloco H',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 72,
      nome: 'Luciana Ferreira',
      registro: 'Atendimento na recepção',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 12,
      nome: 'Antonio Silva',
      registro: 'Fiscalizando salas de aula do bloco I',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 73,
      nome: 'Gabriel Martins',
      registro: 'Supervisão de eventos no auditório',
      nivel: 'Alto',
      status: 'Concluído',
    }),
    withCoords({
      id: 13,
      nome: 'Lucia Costa',
      registro: 'No laboratório de informática do bloco J',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 14,
      nome: 'Paulo Oliveira',
      registro: 'Fiscalizando banheiro do terceiro andar do bloco K',
      nivel: 'Alto',
      status: 'Concluído',
    }),
    withCoords({
      id: 15,
      nome: 'Rita Alves',
      registro: 'Limpeza da sala de professores do bloco L',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 16,
      nome: 'Jose Santos',
      registro: 'Na área externa do bloco N',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 17,
      nome: 'Teresa Lima',
      registro: 'Fiscalizando corredores do bloco O',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 18,
      nome: 'Pedro Costa',
      registro: 'No laboratório de física do bloco P',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
  ],
  Anteontem: [
    withCoords({
      id: 19,
      nome: 'Claudia Mendes',
      registro: 'Fiscalizando banheiro do segundo andar do bloco Q',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 20,
      nome: 'Rafael Silva',
      registro: 'No laboratório de biologia do bloco R',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 21,
      nome: 'Beatriz Santos',
      registro: 'Limpeza da sala de reuniões do bloco S',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 22,
      nome: 'Diego Oliveira',
      registro: 'Fiscalizando corredores do bloco T',
      nivel: 'Alto',
      status: 'Concluído',
    }),
    withCoords({
      id: 23,
      nome: 'Juliana Costa',
      registro: 'No pátio do bloco U',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 24,
      nome: 'Felipe Alves',
      registro: 'Fiscalizando salas de aula do bloco V',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 25,
      nome: 'Camila Lima',
      registro: 'No laboratório de matemática do bloco W',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 26,
      nome: 'Gabriel Santos',
      registro: 'Fiscalizando banheiro do primeiro andar do bloco X',
      nivel: 'Alto',
      status: 'Concluído',
    }),
  ],
  "Há 3 dias": [
    withCoords({
      id: 27,
      nome: 'Renato Barbosa',
      registro: 'Inspeção do estacionamento leste',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 28,
      nome: 'Sofia Martins',
      registro: 'Acompanhamento na sala multimídia do bloco Y',
      nivel: 'Máximo',
      status: 'Pendente',
    }),
    withCoords({
      id: 29,
      nome: 'Eduardo Lima',
      registro: 'Verificação de extintores no corredor principal',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 30,
      nome: 'Larissa Souza',
      registro: 'Fiscalização do acesso ao bloco Z',
      nivel: 'Alto',
      status: 'Não Concluído',
    }),
    withCoords({
      id: 31,
      nome: 'Thiago Rocha',
      registro: 'Suporte na recepção do bloco A',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 32,
      nome: 'Amanda Ribeiro',
      registro: 'Monitoramento do pátio central',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
  ],
  "Há 4 dias": [
    withCoords({
      id: 33,
      nome: 'Bruno Carvalho',
      registro: 'Limpeza de área comum no bloco C',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 34,
      nome: 'Daniela Freitas',
      registro: 'Apoio na organização do laboratório de física',
      nivel: 'Máximo',
      status: 'Pendente',
    }),
    withCoords({
      id: 35,
      nome: 'Igor Menezes',
      registro: 'Ronda noturna nos corredores do bloco D',
      nivel: 'Alto',
      status: 'Concluído',
    }),
    withCoords({
      id: 36,
      nome: 'Carolina Pires',
      registro: 'Inspeção de iluminação externa',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 37,
      nome: 'Marcelo Teixeira',
      registro: 'Verificação do sistema de som no auditório',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 38,
      nome: 'Pablo Nunes',
      registro: 'Acompanhamento de manutenção no bloco B',
      nivel: 'Alto',
      status: 'Não Concluído',
    }),
  ],
  "Há 5 dias": [
    withCoords({
      id: 39,
      nome: 'Helena Araujo',
      registro: 'Organização de materiais na biblioteca',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 40,
      nome: 'Victor Santos',
      registro: 'Suporte no laboratório de informática',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 41,
      nome: 'Marina Faria',
      registro: 'Fiscalização de equipamentos esportivos na quadra',
      nivel: 'Alto',
      status: 'Pendente',
    }),
    withCoords({
      id: 42,
      nome: 'Rodrigo Reis',
      registro: 'Inspeção das saídas de emergência do bloco E',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
    withCoords({
      id: 43,
      nome: 'Tatiane Moraes',
      registro: 'Acompanhamento na secretaria acadêmica',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 44,
      nome: 'Leandro Souza',
      registro: 'Ronda nas áreas externas próximas ao bloco F',
      nivel: 'Alto',
      status: 'Concluído',
    }),
  ],
  "Há 6 dias": [
    withCoords({
      id: 45,
      nome: 'Elaine Prado',
      registro: 'Verificação de credenciais na portaria principal',
      nivel: 'Normal',
      status: 'Concluído',
    }),
    withCoords({
      id: 46,
      nome: 'Fábio Costa',
      registro: 'Monitoramento do fluxo no corredor do bloco G',
      nivel: 'Máximo',
      status: 'Pendente',
    }),
    withCoords({
      id: 47,
      nome: 'Nathalia Queiroz',
      registro: 'Apoio em evento no auditório principal',
      nivel: 'Baixo',
      status: 'Concluído',
    }),
    withCoords({
      id: 48,
      nome: 'Otávio Barros',
      registro: 'Inspeção do laboratório de química',
      nivel: 'Alto',
      status: 'Concluído',
    }),
    withCoords({
      id: 49,
      nome: 'Priscila Dias',
      registro: 'Fiscalização do refeitório estudantil',
      nivel: 'Normal',
      status: 'Não Concluído',
    }),
    withCoords({
      id: 50,
      nome: 'Rafael Gomes',
      registro: 'Ronda em áreas verdes do campus',
      nivel: 'Máximo',
      status: 'Concluído',
    }),
  ],
}

export function getTodasAtividades(): Atividade[] {
  return Object.values(atividadesPorDia).flat()
}


