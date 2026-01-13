export interface SearchResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  content: string;
  score?: number;
}

export interface IVectorService {
  /**
   * Transforma a pergunta em vetor e busca no banco de dados.
   * @param query A pergunta do professor ou aluno.
   * @param limit Quantidade de trechos para retornar (padrão: 3).
   */
  search(query: string, limit?: number): Promise<SearchResult[]>;
}
