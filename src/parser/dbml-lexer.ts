// ============================================================
// DBML Lexer — tokenises DBML source into a token stream
// ============================================================

// --- Token types ---

export enum TokenType {
  // Keywords
  PROJECT = 'PROJECT',
  TABLE = 'TABLE',
  ENUM = 'ENUM',
  REF = 'REF',
  TABLE_GROUP = 'TABLEGROUP',
  INDEXES = 'INDEXES',
  NOTE = 'NOTE',
  RECORDS = 'RECORDS',

  // Symbols
  LBRACE = '{',
  RBRACE = '}',
  LPAREN = '(',
  RPAREN = ')',
  LBRACKET = '[',
  RBRACKET = ']',
  COLON = ':',
  COMMA = ',',
  DOT = '.',
  EQ = '=',
  GT = '>',
  LT = '<',
  NEQ = '<>',

  // Literals
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  MULTILINE_STRING = 'MULTILINE_STRING',

  // Comments
  LINE_COMMENT = 'LINE_COMMENT',

  // End of file
  EOF = 'EOF',
}

// --- Token ---

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

// --- Keyword map ---

const KEYWORDS: Record<string, TokenType> = {
  Project: TokenType.PROJECT,
  Table: TokenType.TABLE,
  Enum: TokenType.ENUM,
  Ref: TokenType.REF,
  TableGroup: TokenType.TABLE_GROUP,
  Indexes: TokenType.INDEXES,
  Note: TokenType.NOTE,
  Records: TokenType.RECORDS,
};

// --- Lexer ---

export class DbmlLexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(input: string) {
    this.input = input;
  }

  /** Tokenise the entire input. */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const tok = this.nextToken();
      if (tok.type !== TokenType.EOF) {
        tokens.push(tok);
      } else {
        break;
      }
    }
    tokens.push(this.eofToken());
    return tokens;
  }

  // --- internal ---

  private eofToken(): Token {
    return { type: TokenType.EOF, value: '', line: this.line, col: this.col };
  }

  private nextToken(): Token {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return this.eofToken();
    }

    const ch = this.input[this.pos];

    // Single-character symbols
    if (ch === '{') return this.emit(TokenType.LBRACE, '{');
    if (ch === '}') return this.emit(TokenType.RBRACE, '}');
    if (ch === '(') return this.emit(TokenType.LPAREN, '(');
    if (ch === ')') return this.emit(TokenType.RPAREN, ')');
    if (ch === '[') return this.emit(TokenType.LBRACKET, '[');
    if (ch === ']') return this.emit(TokenType.RBRACKET, ']');
    if (ch === ':') return this.emit(TokenType.COLON, ':');
    if (ch === ',') return this.emit(TokenType.COMMA, ',');
    if (ch === '=') return this.emit(TokenType.EQ, '=');
    if (ch === '.') return this.emit(TokenType.DOT, '.');

    // Multi-char symbols
    if (ch === '<' && this.peek() === '>') {
      return this.emit(TokenType.NEQ, '<>');
    }
    if (ch === '>') return this.emit(TokenType.GT, '>');
    if (ch === '<') return this.emit(TokenType.LT, '<');

    // Comments: // or --
    if (ch === '-' && this.peek() === '-') {
      return this.readLineComment('--');
    }
    if (ch === '/' && this.peek() === '/') {
      return this.readLineComment('//');
    }

    // Multi-line string: '''
    if (ch === "'" && this.peek() === "'" && this.peek(2) === "'") {
      return this.readMultilineString();
    }

    // Regular strings: '...', "...", `...`
    if (ch === "'" || ch === '"' || ch === '`') {
      return this.readString(ch);
    }

    // Numbers
    if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peek() ?? ''))) {
      return this.readNumber();
    }

    // Identifier or keyword
    if (this.isIdentStart(ch)) {
      return this.readIdentifier();
    }

    // Unknown character — skip with an error note (but don't crash)
    const line = this.line;
    const col = this.col;
    this.advance();
    return { type: TokenType.LINE_COMMENT, value: `// Unexpected character '${ch}'`, line, col };
  }

  // --- helpers ---

  private emit(type: TokenType, value: string): Token {
    const tok: Token = { type, value, line: this.line, col: this.col };
    for (const _ of value) this.advanceRaw();
    return tok;
  }

  private advanceRaw(): void {
    if (this.pos < this.input.length) {
      if (this.input[this.pos] === '\n') {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      this.pos++;
    }
  }

  private advance(): void {
    this.advanceRaw();
  }

  private peek(offset = 1): string | null {
    const idx = this.pos + offset;
    return idx < this.input.length ? this.input[idx] : null;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private isIdentStart(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
  }

  private isIdentPart(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
  }

  private isDigit(ch: string): boolean {
    return /[0-9]/.test(ch);
  }

  // --- readers ---

  private readIdentifier(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let value = '';
    while (this.pos < this.input.length && this.isIdentPart(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    // Check if it's a keyword
    const kw = KEYWORDS[value];
    if (kw) {
      return { type: kw, value, line: startLine, col: startCol };
    }
    return { type: TokenType.IDENTIFIER, value, line: startLine, col: startCol };
  }

  private readString(quote: string): Token {
    const startLine = this.line;
    const startCol = this.col;
    let value = '';
    this.advance(); // skip opening quote
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '\\') {
        this.advance();
        if (this.pos < this.input.length) {
          const escaped = this.input[this.pos];
          if (escaped === 'n') value += '\n';
          else if (escaped === 't') value += '\t';
          else if (escaped === '\\') value += '\\';
          else if (escaped === quote) value += quote;
          else value += escaped;
          this.advance();
        }
        continue;
      }
      if (ch === quote) {
        this.advance(); // skip closing quote
        break;
      }
      if (ch === '\n') {
        // Unterminated string — treat newline as end
        break;
      }
      value += ch;
      this.advance();
    }
    return { type: TokenType.STRING, value, line: startLine, col: startCol };
  }

  private readMultilineString(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // skip first '
    this.advance(); // skip second '
    this.advance(); // skip third '
    let value = '';
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      // Check for closing '''
      if (ch === "'" && this.peek() === "'" && this.peek(2) === "'") {
        this.advance(); // skip '
        this.advance(); // skip '
        this.advance(); // skip '
        break;
      }
      value += ch;
      this.advance();
    }
    return { type: TokenType.MULTILINE_STRING, value, line: startLine, col: startCol };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let value = '';
    if (this.input[this.pos] === '-') {
      value += '-';
      this.advance();
    }
    while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    // Handle decimal point
    if (this.pos < this.input.length && this.input[this.pos] === '.') {
      value += '.';
      this.advance();
      while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
        value += this.input[this.pos];
        this.advance();
      }
    }
    return { type: TokenType.NUMBER, value, line: startLine, col: startCol };
  }

  private readLineComment(prefix: string): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // skip first char of prefix
    this.advance(); // skip second char of prefix
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      value += this.input[this.pos];
      this.advance();
    }
    return { type: TokenType.LINE_COMMENT, value: value.trimStart(), line: startLine, col: startCol };
  }
}
