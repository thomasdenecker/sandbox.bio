const words = {};
const commonKeywords = [
	"if", "else", "while", "for", "in", "function", "return",
	"gsub", "print", "sprintf", "substr",
	"OFS", "BEGIN", "END", "NR", "FS",
];
commonKeywords.forEach(w => words[w] = "keyword");

function tokenBase(stream, state) {
  if (stream.eatSpace()) return null;

  var sol = stream.sol();
  var ch = stream.next();

  if (ch === '\\') {
    stream.next();
    return null;
  }
  if (ch === '\'' || ch === '"' || ch === '`') {
    state.tokens.unshift(tokenString(ch, ch === "`" ? "quote" : "string"));
    return tokenize(stream, state);
  }
  if (ch === '#') {
    if (sol && stream.eat('!')) {
      stream.skipToEnd();
      return 'meta'; // 'comment'?
    }
    stream.skipToEnd();
    return 'comment';
  }
  if (ch === '$') {
    state.tokens.unshift(tokenDollar);
    return tokenize(stream, state);
  }
  if (["+", "-", "=", "<", ">"].includes(ch)) {
    return 'operator';
  }
  if (/\d/.test(ch)) {
    stream.eatWhile(/\d/);
    if(stream.eol() || !/\w/.test(stream.peek())) {
      return 'number';
    }
  }
  stream.eatWhile(/[\w-]/);
  var cur = stream.current();
  if (stream.peek() === '=' && /\w+/.test(cur)) return 'def';
  return words.hasOwnProperty(cur) ? words[cur] : null;
}

function tokenString(quote, style) {
  var close = quote == "(" ? ")" : quote == "{" ? "}" : quote
  return function(stream, state) {
    var next, escaped = false;
    while ((next = stream.next()) != null) {
      if (next === close && !escaped) {
        state.tokens.shift();
        break;
      } else if (next === '$' && !escaped && quote !== "'" && stream.peek() != close) {
        escaped = true;
        stream.backUp(1);
        state.tokens.unshift(tokenDollar);
        break;
      } else if (!escaped && quote !== close && next === quote) {
        state.tokens.unshift(tokenString(quote, style))
        return tokenize(stream, state)
      } else if (!escaped && /['"]/.test(next) && !/['"]/.test(quote)) {
        state.tokens.unshift(tokenStringStart(next, "string"));
        stream.backUp(1);
        break;
      }
      escaped = !escaped && next === '\\';
    }
    return style;
  };
};

function tokenStringStart(quote, style) {
  return function(stream, state) {
    state.tokens[0] = tokenString(quote, style)
    stream.next()
    return tokenize(stream, state)
  }
}

var tokenDollar = function(stream, state) {
  if (state.tokens.length > 1) stream.eat('$');
  var ch = stream.next()
  if (/['"({]/.test(ch)) {
    state.tokens[0] = tokenString(ch, ch == "(" ? "quote" : ch == "{" ? "def" : "string");
    return tokenize(stream, state);
  }
  if (!/\d/.test(ch)) stream.eatWhile(/\w/);
  state.tokens.shift();
  return 'def';
};

function tokenize(stream, state) {
  return (state.tokens[0] || tokenBase)(stream, state);
};

export const awk = {
  startState: function() {return {tokens:[]};},
  token: tokenize,
  languageData: {
    // autocomplete: commonKeywords,
    closeBrackets: {brackets: ["(", "[", "{", "'", '"', "`"]},
    commentTokens: {line: "#"}
  }
};
