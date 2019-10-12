const flatten = (agg, [type, name]) => {
  if (!Array.isArray(type)) return agg.concat([[type, name]])
  return agg.concat(type.reduce(flatten, []).map(([t, n]) => [t, `${name}__${n}`]))
}

const nest = (properties, prefix = '') => {
  return properties.map(([type, name]) => {
    if (!Array.isArray(type)) return `'${name}' => $${prefix + name}`
    return `'${name}' => [${nest(type, prefix + name + '__')}]`
  }).join(',\n')
}

module.exports = {
  request: (namespace, name, method, url, properties) => `<?php

  declare(strict_types=1);

  namespace ${namespace};

  use Symfony\\Component\\HttpFoundation\\Request;

  final class ${name}
  {
  ${properties.map(([type, name]) => `
  /** @var ${type} */
  public $${name};
  `).join('')}

  private function __construct(
  ${properties.reduce(flatten, []).map(([type, name]) => `${type} $${name}`).join(', \n        ')}
  ) {
${properties.reduce(flatten, []).map(([_, name]) => `$this->${name} = $${name};`)}
  }

  public function fromRequest(Request $request): self
  {
  if (!$request->isMethod('${method}')) {
    throw new \\BadMethodCallException('Method should be ${method}');
  }
  if ($request->getBaseUrl() !== '${url}') {
    throw new \\BadMethodCallException('URL '.$request->getBaseUrl().'does not match expected: "${url}"');
  }
  ${properties.length
    ? `
    $requestData = ${
  method === 'POST'
    ? 'json_decode($request->getContent(), true);'
    : '$request->query->all();'
}
    `
    : ''}
      return new self(
      ${
  properties.map(([_, name]) => {
    return `$requestData['${name}'] ?? null`
  }).join(', \n            ')
}
      );
      }
}
      `,

  response: (namespace, name, status, properties) => `<?php
      declare(strict_types=1);

      namespace ${namespace};

      use Symfony\\Component\\HttpFoundation\\JsonResponse;

      final class ${name}Response extends JsonResponse
      {


      public  function __construct(
        ${properties.reduce(flatten, []).map(([type, name]) => `${type} $${name}`).join(', \n        ')}
      )
      {
        return parent::__construct(
        [${nest(properties)}], ${status}
        );
      }

      }

      `
}
