#!/usr/bin/env node

const Fastify = require('fastify');
const { analyzeCode } = require('./analyzer.cjs');

/**
 * MCP (Model Control Protocol) Server for VERIDEC
 * Provides API endpoints for code analysis
 */

async function startServer(port = 3000) {
  const fastify = Fastify({
    logger: true
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return { status: 'healthy' };
  });

  // Analysis endpoint for single file
  fastify.post('/analyze', async (request, reply) => {
    try {
      const { code, filePath = 'unnamed-file' } = request.body;
      
      if (!code) {
        reply.code(400).send({ error: 'No code provided in request body' });
        return;
      }

      const result = await analyzeCode(code, filePath);
      reply.send(result);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ 
        error: 'Analysis failed',
        message: error.message
      });
    }
  });

  // Batch analysis endpoint
  fastify.post('/analyze/batch', async (request, reply) => {
    try {
      const { files } = request.body;
      
      if (!files || !Array.isArray(files) || files.length === 0) {
        reply.code(400).send({ error: 'No files provided in request body' });
        return;
      }

      const results = await Promise.all(files.map(async (file, index) => {
        try {
          const result = await analyzeCode(file.code, file.filePath || `unnamed-file-${index}`);
          return result;
        } catch (error) {
          return {
            filePath: file.filePath || `unnamed-file-${index}`,
            error: error.message,
            issues: [],
            impactScore: 0
          };
        }
      }));

      reply.send(results);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ 
        error: 'Batch analysis failed',
        message: error.message
      });
    }
  });

  // Impact assessment endpoint
  fastify.post('/impact', async (request, reply) => {
    try {
      const { results } = request.body;
      
      if (!results || !Array.isArray(results)) {
        reply.code(400).send({ error: 'No analysis results provided' });
        return;
      }

      let maxScore = 0;
      let totalIssues = 0;
      let highSeverityCount = 0;

      results.forEach(result => {
        if (result.impactScore > maxScore) {
          maxScore = result.impactScore;
        }
        
        if (result.issues) {
          totalIssues += result.issueCount || result.issues.length;
          result.issues.forEach(issue => {
            if (issue.severity === 'high') highSeverityCount++;
          });
        } else {
          totalIssues += result.issueCount || 0;
        }
      });

      let status = 'approved';
      if (totalIssues > 0) {
        if (highSeverityCount > 0 || maxScore > 75) {
          status = 'review_required';
        } else if (maxScore > 25) {
          status = 'conditional_approved';
        }
      }

      reply.send({
        impactScore: maxScore,
        issuesCount: totalIssues,
        highSeverityCount,
        status
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ 
        error: 'Impact assessment failed',
        message: error.message
      });
    }
  });

  try {
    await fastify.listen({ port, host: '127.0.0.1' });
    console.log(`VERIDEC MCP Server listening on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

module.exports = { startServer };

if (require.main === module) {
  const port = process.env.MCP_PORT || 3000;
  startServer(parseInt(port, 10));
}
