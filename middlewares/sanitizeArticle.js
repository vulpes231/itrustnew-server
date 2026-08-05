const sanitizeHtml = require("sanitize-html");

const sanitizeArticle = (req, res, next) => {
  if (!req.body.content) {
    return next();
  }

  req.body.content = sanitizeHtml(req.body.content, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "a",
      "img",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "span",
      "div",
    ],

    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt"],
    },

    allowedSchemes: ["http", "https", "mailto"],

    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });

  next();
};

module.exports = sanitizeArticle;
